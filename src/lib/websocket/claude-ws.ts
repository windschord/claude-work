import { WebSocket, WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs/promises';
import {
  claudePtyManager,
  type ClaudePTYExitInfo,
} from '@/services/claude-pty-manager';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { environmentService } from '@/services/environment-service';
import { AdapterFactory } from '@/services/adapter-factory';
import type { EnvironmentAdapter, PTYExitInfo } from '@/services/environment-adapter';
import type {
  ClaudeDataMessage,
  ClaudeExitMessage,
  ClaudeErrorMessage,
  ClaudeImageSavedMessage,
  ClaudeImageErrorMessage,
  ClaudeScrollbackMessage,
} from '@/types/websocket';

// PTY破棄の猶予期間（ミリ秒）
// クライアントが一時的に切断しても、この期間内に再接続すればPTYセッションを維持できる
// デフォルト5分。環境変数PTY_DESTROY_GRACE_PERIOD_MSで変更可能
const PTY_DESTROY_GRACE_PERIOD = (() => {
  const raw = process.env.PTY_DESTROY_GRACE_PERIOD_MS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300000;
})();

// セッションごとの破棄タイマーを管理
const destroyTimers = new Map<string, ReturnType<typeof setTimeout>>();
// セッションごとのアクティブな接続数を管理
const activeConnections = new Map<string, number>();

// 画像の最大サイズ（10MB）
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// 許可するMIMEタイプと拡張子のマッピング
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/**
 * クリップボードからペーストされた画像をファイルに保存し、
 * パスをPTY入力として送信する
 */
async function handlePasteImage(
  data: { data: string; mimeType: string },
  sessionId: string,
  worktreePath: string,
  ws: WebSocket,
  isLegacy: boolean,
  adapter: EnvironmentAdapter | null,
): Promise<void> {
  try {
    // MIMEタイプ検証
    const ext = ALLOWED_IMAGE_TYPES[data.mimeType];
    if (!ext) {
      throw new Error(`Unsupported image type: ${data.mimeType}`);
    }

    // Base64文字列長の事前チェック（デコード前にサイズ超過を検出）
    const maxBase64Length = Math.ceil(MAX_IMAGE_SIZE / 3) * 4;
    if (data.data.length > maxBase64Length) {
      throw new Error(`Image too large: base64 string exceeds maximum allowed length (max decoded size: ${MAX_IMAGE_SIZE} bytes)`);
    }

    // Base64デコード
    const buffer = Buffer.from(data.data, 'base64');

    // サイズ制限チェック（デコード後の正確なサイズ検証）
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${buffer.length} bytes (max: ${MAX_IMAGE_SIZE})`);
    }

    // 保存先ディレクトリ
    const imageDir = path.join(worktreePath, '.claude-images');
    const resolvedDir = path.resolve(imageDir);
    const resolvedWorktree = path.resolve(worktreePath);

    // パストラバーサル防止
    if (!resolvedDir.startsWith(resolvedWorktree + path.sep) && resolvedDir !== resolvedWorktree) {
      throw new Error('Invalid image directory path');
    }

    await fs.mkdir(resolvedDir, { recursive: true });

    // ファイル名生成（タイムスタンプ + ランダム文字列）
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `clipboard-${timestamp}-${random}${ext}`;
    const filePath = path.join(resolvedDir, filename);

    // ファイル保存
    await fs.writeFile(filePath, buffer);

    // ファイルパスをPTY入力として送信
    // NOTE: ホスト上の絶対パスをPTYに送信する。
    // Docker/SSH環境では、このパスがコンテナ/リモート上で無効になる可能性がある。
    // 環境ごとのパス変換は将来の課題として残す。
    if (isLegacy) {
      claudePtyManager.write(sessionId, filePath);
    } else if (adapter) {
      adapter.write(sessionId, filePath);
    } else {
      throw new Error('Adapter not available');
    }

    // 成功メッセージを送信
    if (ws.readyState === WebSocket.OPEN) {
      const msg: ClaudeImageSavedMessage = {
        type: 'image-saved',
        filePath,
      };
      ws.send(JSON.stringify(msg));
    }

    logger.info('Claude WebSocket: Image saved', {
      sessionId,
      filePath,
      mimeType: data.mimeType,
      size: buffer.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save image';
    logger.error('Claude WebSocket: Failed to save image', {
      sessionId,
      error: errorMessage,
    });

    if (ws.readyState === WebSocket.OPEN) {
      const msg: ClaudeImageErrorMessage = {
        type: 'image-error',
        message: errorMessage,
      };
      ws.send(JSON.stringify(msg));
    }
  }
}

/**
 * Claude Code WebSocketサーバーをセットアップ
 *
 * WebSocket経由でClaude Code PTY入出力を中継する。
 *
 * @param wss - WebSocketサーバーインスタンス
 * @param _path - WebSocketパス（使用しない、互換性のため）
 */
export function setupClaudeWebSocket(
  wss: WebSocketServer,
  _path: string
): void {
  wss.on('connection', async (ws: WebSocket, req) => {
    // URLからセッションIDを取得
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const last = pathParts[pathParts.length - 1];
    const sessionId =
      last === 'claude' ? pathParts[pathParts.length - 2] : last;

    // セッションID検証
    if (!sessionId || sessionId === '') {
      logger.warn('Claude WebSocket: Session ID missing');
      ws.close(1008, 'Session ID required');
      return;
    }

    // セッション存在確認
    try {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sessionId),
      });

      if (!session) {
        logger.warn('Claude WebSocket: Session not found', { sessionId });
        ws.close(1008, 'Session not found');
        return;
      }

      // 破棄タイマーがあればキャンセル（再接続時）
      const existingTimer = destroyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        destroyTimers.delete(sessionId);
        logger.info('Claude WebSocket: Cancelled PTY destroy timer (client reconnected)', { sessionId });
      }

      // 接続数を増やす
      const currentConnections = activeConnections.get(sessionId) || 0;
      activeConnections.set(sessionId, currentConnections + 1);

      // アダプター選択とセットアップ
      // 戻り値: { adapter: EnvironmentAdapter, isLegacy: boolean }
      // isLegacy = true の場合は claudePtyManager を直接使用（後方互換性）
      let adapter: EnvironmentAdapter | null = null;
      let isLegacy = false;

      // 環境選択ロジック:
      // 1. environment_id が指定されている → 新方式（AdapterFactory経由）
      // 2. docker_mode=true かつ environment_id未指定 → レガシー方式（claudePtyManager直接）
      // 3. 両方未指定 → デフォルト環境（新方式）
      if (session.environment_id) {
        // 新方式: environment_id で環境を取得
        const environment = await environmentService.findById(session.environment_id);
        if (!environment) {
          logger.error('Claude WebSocket: Environment not found', {
            sessionId,
            environmentId: session.environment_id,
          });
          const errorMsg: ClaudeErrorMessage = {
            type: 'error',
            message: `Environment not found: ${session.environment_id}`,
          };
          ws.send(JSON.stringify(errorMsg));
          ws.close(1008, 'Environment not found');
          return;
        }
        adapter = AdapterFactory.getAdapter(environment);
        logger.info('Claude WebSocket: Using adapter for environment', {
          sessionId,
          environmentId: environment.id,
          environmentType: environment.type,
        });
      } else if (session.docker_mode && !session.environment_id) {
        // レガシー方式: dockerMode=true で environment_id 未指定
        isLegacy = true;
        logger.info('Claude WebSocket: Using legacy claudePtyManager (dockerMode)', {
          sessionId,
        });
      } else {
        // デフォルト環境を使用
        try {
          const defaultEnv = await environmentService.getDefault();
          adapter = AdapterFactory.getAdapter(defaultEnv);
          logger.info('Claude WebSocket: Using default environment', {
            sessionId,
            environmentId: defaultEnv.id,
            environmentType: defaultEnv.type,
          });
        } catch (defaultEnvError) {
          logger.error('Claude WebSocket: Failed to get default environment', {
            sessionId,
            error: defaultEnvError,
          });
          const errorMsg: ClaudeErrorMessage = {
            type: 'error',
            message: 'Failed to get default environment',
          };
          ws.send(JSON.stringify(errorMsg));
          ws.close(1011, 'Default environment not found');
          return;
        }
      }

      // 選択したマネージャー/アダプターでセッションの有無を確認
      const hasSession = isLegacy
        ? claudePtyManager.hasSession(sessionId)
        : adapter!.hasSession(sessionId);

      // Claude PTY作成（既に存在する場合はスキップ）
      if (!hasSession) {
        // initializingの場合のみ初回プロンプトを送信（レジューム時は重複防止）
        let initialPrompt: string | undefined;
        if (session.status === 'initializing') {
          const firstMessage = await db.query.messages.findFirst({
            where: eq(schema.messages.session_id, sessionId),
            orderBy: [asc(schema.messages.created_at)],
          });
          initialPrompt = firstMessage?.content;
          logger.info('Claude WebSocket: Fetched initial prompt from database', {
            sessionId,
            hasInitialPrompt: !!initialPrompt,
            promptLength: initialPrompt?.length,
            worktreePath: session.worktree_path,
          });
        } else {
          logger.info('Claude WebSocket: Skipping initial prompt (session already started)', {
            sessionId,
            status: session.status,
            resumeSessionId: session.resume_session_id,
          });
        }

        // Claude PTYを作成
        try {
          if (isLegacy) {
            // レガシー方式
            claudePtyManager.createSession(
              sessionId,
              session.worktree_path,
              initialPrompt,
              {
                dockerMode: session.docker_mode,
                resumeSessionId: session.resume_session_id || undefined,
              }
            );
          } else {
            // 新方式（アダプター経由）
            adapter!.createSession(
              sessionId,
              session.worktree_path,
              initialPrompt,
              { resumeSessionId: session.resume_session_id || undefined }
            );
          }
          logger.info('Claude PTY created for session', {
            sessionId,
            hasInitialPrompt: !!initialPrompt,
            isLegacy,
            dockerMode: session.docker_mode,
          });

          // セッションステータスを'running'に更新
          await db.update(schema.sessions)
            .set({ status: 'running' })
            .where(eq(schema.sessions.id, sessionId))
            .run();
        } catch (ptyError) {
          // PTY作成エラーをクライアントに通知
          const errorMessage = ptyError instanceof Error ? ptyError.message : 'Failed to create PTY';
          logger.error('Claude WebSocket: Failed to create PTY', {
            sessionId,
            error: errorMessage,
            worktreePath: session.worktree_path,
          });

          // クライアントにエラーメッセージを送信
          const errorMsg: ClaudeErrorMessage = {
            type: 'error',
            message: `PTY creation failed: ${errorMessage}`,
          };
          ws.send(JSON.stringify(errorMsg));
          // PTYが作成できなかったため、このWebSocket接続はこれ以上利用できない
          // クライアント側の状態と整合性を取るため、接続をクローズする
          ws.close(1000, 'PTY creation failed');

          // セッションステータスをエラーに更新
          await db.update(schema.sessions)
            .set({ status: 'error' })
            .where(eq(schema.sessions.id, sessionId))
            .run();
          return;
        }
      }

      // イベントハンドラーの定義
      // アダプター用のイベントハンドラー
      const adapterDataHandler = (sid: string, data: string) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const adapterExitHandler = (sid: string, info: PTYExitInfo) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeExitMessage = {
            type: 'exit',
            exitCode: info.exitCode,
            signal: info.signal ?? null,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const adapterErrorHandler = (sid: string, error: Error) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeErrorMessage = {
            type: 'error',
            message: error.message,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const claudeSessionIdHandler = async (sid: string, claudeSessionId: string) => {
        if (sid === sessionId) {
          try {
            await db.update(schema.sessions)
              .set({ resume_session_id: claudeSessionId })
              .where(eq(schema.sessions.id, sessionId))
              .run();
            logger.info('Claude session ID saved to database', {
              sessionId,
              claudeSessionId,
            });
          } catch (error) {
            logger.error('Failed to save Claude session ID to database', {
              sessionId,
              claudeSessionId,
              error,
            });
          }
        }
      };

      // レガシー用のイベントハンドラー（ClaudePTYExitInfo型用）
      const legacyExitHandler = (sid: string, { exitCode, signal }: ClaudePTYExitInfo) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeExitMessage = {
            type: 'exit',
            exitCode,
            signal: signal ?? null,
          };
          ws.send(JSON.stringify(message));
        }
      };

      // イベントハンドラーを登録
      if (isLegacy) {
        claudePtyManager.on('data', adapterDataHandler);
        claudePtyManager.on('exit', legacyExitHandler);
        claudePtyManager.on('error', adapterErrorHandler);
        claudePtyManager.on('claudeSessionId', claudeSessionIdHandler);
      } else {
        adapter!.on('data', adapterDataHandler);
        adapter!.on('exit', adapterExitHandler);
        adapter!.on('error', adapterErrorHandler);
        adapter!.on('claudeSessionId', claudeSessionIdHandler);
      }

      // 既存PTYセッションの場合、スクロールバックバッファを再送
      // scrollbackBufferはClaudePTYManagerで一元管理（Docker含む全セッション）
      if (hasSession) {
        const buffer = claudePtyManager.getScrollbackBuffer(sessionId);
        if (buffer && ws.readyState === WebSocket.OPEN) {
          const scrollbackMsg: ClaudeScrollbackMessage = {
            type: 'scrollback',
            content: buffer,
          };
          ws.send(JSON.stringify(scrollbackMsg));
          logger.info('Claude WebSocket: Sent scrollback buffer', {
            sessionId,
            bufferLength: buffer.length,
          });
        }
      }

      // WebSocket入力 → PTY
      ws.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          // メッセージ型の検証
          if (!data || typeof data !== 'object' || !data.type) {
            logger.warn('Claude WebSocket: Invalid message format', {
              sessionId,
            });
            return;
          }

          if (data.type === 'input') {
            if (typeof data.data !== 'string') {
              logger.warn('Claude WebSocket: Invalid input data type', {
                sessionId,
              });
              return;
            }
            if (isLegacy) {
              claudePtyManager.write(sessionId, data.data);
            } else {
              adapter!.write(sessionId, data.data);
            }
          } else if (data.type === 'resize') {
            // resize データの検証
            // ターミナルサイズは正の整数でなければならない
            if (
              !data.data ||
              typeof data.data.cols !== 'number' ||
              typeof data.data.rows !== 'number' ||
              !Number.isFinite(data.data.cols) ||
              !Number.isFinite(data.data.rows) ||
              !Number.isInteger(data.data.cols) ||
              !Number.isInteger(data.data.rows) ||
              data.data.cols <= 0 ||
              data.data.rows <= 0 ||
              data.data.cols > 1000 ||
              data.data.rows > 1000
            ) {
              logger.warn('Claude WebSocket: Invalid resize dimensions', {
                sessionId,
                cols: data.data?.cols,
                rows: data.data?.rows,
              });
              return;
            }
            if (isLegacy) {
              claudePtyManager.resize(sessionId, data.data.cols, data.data.rows);
            } else {
              adapter!.resize(sessionId, data.data.cols, data.data.rows);
            }
          } else if (data.type === 'restart') {
            // Claude Codeプロセスを再起動
            logger.info('Claude WebSocket: Restarting Claude Code', {
              sessionId,
            });
            if (isLegacy) {
              claudePtyManager.restartSession(
                sessionId,
                session.worktree_path,
                undefined,
                { dockerMode: session.docker_mode }
              );
            } else {
              adapter!.restartSession(sessionId, session.worktree_path);
            }
          } else if (data.type === 'paste-image') {
            // 画像ペースト処理
            if (typeof data.data !== 'string' || typeof data.mimeType !== 'string') {
              logger.warn('Claude WebSocket: Invalid paste-image data', { sessionId });
              return;
            }
            await handlePasteImage(data, sessionId, session.worktree_path, ws, isLegacy, adapter);
          } else {
            logger.warn('Claude WebSocket: Unknown message type', {
              sessionId,
              type: data.type,
            });
          }
        } catch (error) {
          logger.error('Claude WebSocket: Failed to parse message', {
            sessionId,
            error,
          });
        }
      });

      // クリーンアップ
      ws.on('close', () => {
        // イベントハンドラーを解除
        if (isLegacy) {
          claudePtyManager.off('data', adapterDataHandler);
          claudePtyManager.off('exit', legacyExitHandler);
          claudePtyManager.off('error', adapterErrorHandler);
          claudePtyManager.off('claudeSessionId', claudeSessionIdHandler);
        } else {
          adapter!.off('data', adapterDataHandler);
          adapter!.off('exit', adapterExitHandler);
          adapter!.off('error', adapterErrorHandler);
          adapter!.off('claudeSessionId', claudeSessionIdHandler);
        }

        // 接続数を減らす
        const connections = activeConnections.get(sessionId) || 0;
        const newConnections = Math.max(0, connections - 1);
        activeConnections.set(sessionId, newConnections);

        // 接続数が0になった場合のみ、猶予期間後にPTYを破棄
        const hasActiveSession = isLegacy
          ? claudePtyManager.hasSession(sessionId)
          : adapter!.hasSession(sessionId);

        if (newConnections === 0 && hasActiveSession) {
          logger.info('Claude WebSocket: Starting PTY destroy timer', {
            sessionId,
            gracePeriodMs: PTY_DESTROY_GRACE_PERIOD,
          });

          const timer = setTimeout(() => {
            destroyTimers.delete(sessionId);
            // 猶予期間後も接続がなければPTYを破棄
            const stillHasSession = isLegacy
              ? claudePtyManager.hasSession(sessionId)
              : adapter!.hasSession(sessionId);

            if ((activeConnections.get(sessionId) || 0) === 0 && stillHasSession) {
              if (isLegacy) {
                claudePtyManager.destroySession(sessionId);
              } else {
                adapter!.destroySession(sessionId);
              }
              logger.info('Claude WebSocket: PTY destroyed after grace period', { sessionId });
            }
          }, PTY_DESTROY_GRACE_PERIOD);

          destroyTimers.set(sessionId, timer);
        }

        logger.info('Claude WebSocket connection closed', { sessionId });
      });

      logger.info('Claude WebSocket connection established', { sessionId });
    } catch (error) {
      logger.error('Claude WebSocket: Error during connection setup', {
        sessionId,
        error,
      });
      ws.close(1011, 'Internal server error');
    }
  });
}
