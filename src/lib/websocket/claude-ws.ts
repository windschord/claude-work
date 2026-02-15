import { WebSocket, WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs/promises';
import { ptySessionManager } from '@/services/pty-session-manager';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { environmentService } from '@/services/environment-service';
import { ClaudeOptionsService } from '@/services/claude-options-service';
import type {
  ClaudeErrorMessage,
  ClaudeImageSavedMessage,
  ClaudeImageErrorMessage,
  ClaudeScrollbackMessage,
} from '@/types/websocket';

// PTY破棄の猶予期間（ミリ秒）
// クライアントが一時的に切断しても、この期間内に再接続すればPTYセッションを維持できる
// デフォルト5分。環境変数PTY_DESTROY_GRACE_PERIOD_MSで変更可能
// -1を指定するとPTY破棄を無効化（クライアント切断後も永続的に維持）
const PTY_DESTROY_GRACE_PERIOD = (() => {
  const raw = process.env.PTY_DESTROY_GRACE_PERIOD_MS;
  if (!raw) return 300000;
  const parsed = Number.parseInt(raw, 10);
  if (parsed === -1) return -1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300000;
})();

// セッションごとの破棄タイマーを管理
const destroyTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 画像の最大サイズ（10MB）
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * リサイズメッセージのバリデーション
 *
 * cols/rowsが正の整数かつ1-1000の範囲内であることを検証する。
 * 有効な場合は { cols, rows } を返し、無効な場合は null を返す。
 */
const validateResizeDimensions = (
  data: unknown,
): { cols: number; rows: number } | null => {
  if (
    data &&
    typeof data === 'object' &&
    'cols' in data &&
    'rows' in data &&
    typeof (data as Record<string, unknown>).cols === 'number' &&
    typeof (data as Record<string, unknown>).rows === 'number' &&
    Number.isFinite((data as Record<string, unknown>).cols) &&
    Number.isFinite((data as Record<string, unknown>).rows) &&
    Number.isInteger((data as Record<string, unknown>).cols) &&
    Number.isInteger((data as Record<string, unknown>).rows) &&
    ((data as Record<string, unknown>).cols as number) > 0 &&
    ((data as Record<string, unknown>).rows as number) > 0 &&
    ((data as Record<string, unknown>).cols as number) <= 1000 &&
    ((data as Record<string, unknown>).rows as number) <= 1000
  ) {
    return {
      cols: (data as Record<string, number>).cols,
      rows: (data as Record<string, number>).rows,
    };
  }
  return null;
};

/**
 * Bufferからリサイズメッセージをパース・検証する
 *
 * WebSocket接続初期の早期メッセージハンドラーおよびメインハンドラーで使用。
 * JSONパースに失敗した場合やresizeメッセージでない場合は null を返す。
 */
const parseResizeMessage = (
  message: Buffer,
): { cols: number; rows: number } | null => {
  try {
    const data = JSON.parse(message.toString());
    if (data?.type === 'resize' && data.data) {
      return validateResizeDimensions(data.data);
    }
  } catch {
    // パースエラーは無視
  }
  return null;
};

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
    ptySessionManager.sendInput(sessionId, filePath);

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
 * PTYSessionManager経由でセッション管理を行う。
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

    // セッション準備前のリサイズメッセージをキャプチャ
    // クライアントはws.onopenで即座にresizeを送信するが、
    // サーバー側のメッセージハンドラーは複数のawait後に登録されるため、
    // 初期リサイズがEventEmitter上で消失する可能性がある。
    // この早期ハンドラーでresizeをバッファし、セットアップ完了後に適用する。
    let pendingResize: { cols: number; rows: number } | null = null;
    const earlyMessageHandler = (message: Buffer) => {
      const resize = parseResizeMessage(message);
      if (resize) {
        pendingResize = resize;
      }
    };
    ws.on('message', earlyMessageHandler);

    // セッション存在確認
    try {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sessionId),
        with: {
          project: {
            columns: {
              environment_id: true,
            },
          },
        },
      });

      if (!session) {
        logger.warn('Claude WebSocket: Session not found', { sessionId });
        ws.off('message', earlyMessageHandler);
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

      // PTYセッションが既に存在する場合はスクロールバックバッファを送信
      const hasSession = ptySessionManager.hasSession(sessionId);

      if (hasSession) {
        // 既存セッションに接続を追加
        ptySessionManager.addConnection(sessionId, ws);

        // スクロールバックバッファを送信
        // Note: connectionManagerはprivateのため、一時的にany経由でアクセス
         
        const connectionManager = (ptySessionManager as any).connectionManager;
        const buffer = connectionManager.getScrollbackBuffer(sessionId);
        if (buffer) {
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
      } else {
        // 新規セッション作成
        try {
          // 初期プロンプトの取得判定：
          // - initializingの場合は常に初回プロンプトを取得
          // - resume_session_idがない場合もフォールバックで初回プロンプトを取得
          //   （サーバー再起動後などにresume_session_idが未保存の場合に対応）
          let initialPrompt: string | undefined;
          const canResume = !!session.resume_session_id;
          if (session.status === 'initializing' || !canResume) {
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
              reason: session.status === 'initializing' ? 'initializing' : 'no-resume-session-id',
            });
          } else {
            logger.info('Claude WebSocket: Skipping initial prompt (session already started)', {
              sessionId,
              status: session.status,
              resumeSessionId: session.resume_session_id,
            });
          }

          // プロジェクトの設定を取得してマージ
          const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, session.project_id),
          });

          const projectOptions = ClaudeOptionsService.parseOptions(project?.claude_code_options);
          const projectEnvVars = ClaudeOptionsService.parseEnvVars(project?.custom_env_vars);
          const sessionOptions = ClaudeOptionsService.parseOptions(session.claude_code_options);
          const sessionEnvVars = ClaudeOptionsService.parseEnvVars(session.custom_env_vars);

          const mergedOptions = ClaudeOptionsService.mergeOptions(projectOptions, sessionOptions);
          const mergedEnvVars = ClaudeOptionsService.mergeEnvVars(projectEnvVars, sessionEnvVars);

          const hasCustomOptions = Object.keys(mergedOptions).length > 0;
          const hasCustomEnvVars = Object.keys(mergedEnvVars).length > 0;

          if (hasCustomOptions || hasCustomEnvVars) {
            logger.info('Claude WebSocket: Applying custom options', {
              sessionId,
              hasCustomOptions,
              hasCustomEnvVars,
              optionKeys: Object.keys(mergedOptions),
              envVarKeys: Object.keys(mergedEnvVars),
            });
          }

          // 環境IDを取得（プロジェクトから、未指定の場合はデフォルト環境）
          let environmentId = session.project?.environment_id;
          if (!environmentId) {
            const defaultEnv = await environmentService.getDefault();
            environmentId = defaultEnv.id;
            logger.info('Claude WebSocket: Using default environment', {
              sessionId,
              environmentId,
            });
          }

          // ターミナルサイズを取得
          const terminalSize: { cols: number; rows: number } = pendingResize ?? { cols: 80, rows: 24 };

          // PTYSessionManager経由でセッション作成
          await ptySessionManager.createSession({
            sessionId,
            projectId: session.project_id,
            branchName: session.branch_name,
            worktreePath: session.worktree_path,
            environmentId,
            initialPrompt,
            resumeSessionId: session.resume_session_id || undefined,
            claudeCodeOptions: hasCustomOptions ? mergedOptions : undefined,
            customEnvVars: hasCustomEnvVars ? mergedEnvVars : undefined,
            cols: terminalSize.cols,
            rows: terminalSize.rows,
          });

          logger.info('Claude PTY created for session', {
            sessionId,
            hasInitialPrompt: !!initialPrompt,
          });

          // セッション作成後に明示的にリサイズを適用
          // Docker環境ではコンテナ起動のオーバーヘッドにより、PTY spawn時の
          // サイズが内部プロセスに反映されない場合がある
          // pendingResizeはearlyMessageHandlerで非同期に更新される可能性があるため再取得
          const currentResize = pendingResize as { cols: number; rows: number } | null;
          if (currentResize) {
            ptySessionManager.resize(sessionId, currentResize.cols, currentResize.rows);
            logger.info('Claude WebSocket: Applied initial resize after session creation', {
              sessionId,
              cols: currentResize.cols,
              rows: currentResize.rows,
            });
          }

          // 接続を追加
          ptySessionManager.addConnection(sessionId, ws);
        } catch (ptyError) {
          // PTY作成エラーをクライアントに通知
          const errorMessage = ptyError instanceof Error ? ptyError.message : 'Failed to create PTY';
          logger.error('Claude WebSocket: Failed to create PTY', {
            sessionId,
            error: errorMessage,
            worktreePath: session.worktree_path,
          });

          const errorMsg: ClaudeErrorMessage = {
            type: 'error',
            message: `PTY creation failed: ${errorMessage}`,
          };
          ws.send(JSON.stringify(errorMsg));
          ws.off('message', earlyMessageHandler);
          ws.close(1000, 'PTY creation failed');

          await db.update(schema.sessions)
            .set({ status: 'error' })
            .where(eq(schema.sessions.id, sessionId))
            .run();
          return;
        }
      }

      // 早期リサイズハンドラーを解除（完全ハンドラーに切り替え）
      ws.off('message', earlyMessageHandler);

      // バッファされたリサイズを適用
      if (pendingResize && hasSession) {
        const { cols, rows } = pendingResize;
        ptySessionManager.resize(sessionId, cols, rows);
        logger.info('Claude WebSocket: Applied pending resize from early buffer', {
          sessionId, cols, rows,
        });
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
            ptySessionManager.sendInput(sessionId, data.data);
          } else if (data.type === 'resize') {
            // resize データの検証（共通バリデーション関数を使用）
            const resizeDims = validateResizeDimensions(data.data);
            if (!resizeDims) {
              logger.warn('Claude WebSocket: Invalid resize dimensions', {
                sessionId,
                cols: data.data?.cols,
                rows: data.data?.rows,
              });
              return;
            }
            ptySessionManager.resize(sessionId, resizeDims.cols, resizeDims.rows);
          } else if (data.type === 'restart') {
            // Claude Codeプロセスを再起動
            logger.info('Claude WebSocket: Restarting Claude Code', {
              sessionId,
            });
            // TODO: PTYSessionManagerにrestartSessionメソッドを追加
            // 現時点では未実装
            logger.warn('Claude WebSocket: Restart not yet implemented via PTYSessionManager', {
              sessionId,
            });
          } else if (data.type === 'paste-image') {
            // 画像ペースト処理
            if (typeof data.data !== 'string' || typeof data.mimeType !== 'string') {
              logger.warn('Claude WebSocket: Invalid paste-image data', { sessionId });
              return;
            }
            await handlePasteImage(data, sessionId, session.worktree_path, ws);
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
        // PTYSessionManagerから接続を削除
        ptySessionManager.removeConnection(sessionId, ws);

        // 接続数を取得
        const newConnections = ptySessionManager.getConnectionCount(sessionId);

        // 接続数が0になった場合のみ、猶予期間後にPTYを破棄
        const hasActiveSession = ptySessionManager.hasSession(sessionId);

        if (newConnections === 0 && hasActiveSession) {
          if (PTY_DESTROY_GRACE_PERIOD === -1) {
            // -1: PTY破棄無効化 — クライアント全切断後もPTYを永続的に維持
            logger.info('Claude WebSocket: PTY destroy disabled (grace period = -1), keeping session alive', {
              sessionId,
            });
          } else {
            logger.info('Claude WebSocket: Starting PTY destroy timer', {
              sessionId,
              gracePeriodMs: PTY_DESTROY_GRACE_PERIOD,
            });

            const timer = setTimeout(() => {
              destroyTimers.delete(sessionId);
              // 猶予期間後も接続がなければPTYを破棄
              const stillHasSession = ptySessionManager.hasSession(sessionId);

              if (ptySessionManager.getConnectionCount(sessionId) === 0 && stillHasSession) {
                ptySessionManager.destroySession(sessionId).catch(error => {
                  logger.error('Claude WebSocket: Failed to destroy session after grace period', {
                    sessionId,
                    error,
                  });
                });
                logger.info('Claude WebSocket: PTY destroyed after grace period', { sessionId });
              }
            }, PTY_DESTROY_GRACE_PERIOD);

            destroyTimers.set(sessionId, timer);
          }
        }

        logger.info('Claude WebSocket connection closed', { sessionId });
      });

      logger.info('Claude WebSocket connection established', { sessionId });
    } catch (error) {
      logger.error('Claude WebSocket: Error during connection setup', {
        sessionId,
        error,
      });
      ws.off('message', earlyMessageHandler);
      ws.close(1011, 'Internal server error');
    }
  });
}
