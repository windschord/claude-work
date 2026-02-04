import { WebSocket, WebSocketServer } from 'ws';
import { ptyManager, type PTYExitInfo } from '@/services/pty-manager';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { environmentService } from '@/services/environment-service';
import { AdapterFactory } from '@/services/adapter-factory';
import type { EnvironmentAdapter, PTYExitInfo as AdapterPTYExitInfo } from '@/services/environment-adapter';

/**
 * ターミナルWebSocketメッセージ型定義
 */

// クライアント → サーバー（入力）
interface TerminalInputMessage {
  type: 'input';
  data: string;
}

// クライアント → サーバー（リサイズ）
interface TerminalResizeMessage {
  type: 'resize';
  data: {
    cols: number;
    rows: number;
  };
}

export type TerminalClientMessage = TerminalInputMessage | TerminalResizeMessage;

// サーバー → クライアント（出力）
interface TerminalDataMessage {
  type: 'data';
  content: string;
}

// サーバー → クライアント（終了）
interface TerminalExitMessage {
  type: 'exit';
  exitCode: number;
  signal: number | null;
}

// サーバー → クライアント（エラー）
interface TerminalErrorMessage {
  type: 'error';
  message: string;
}

export type TerminalServerMessage =
  | TerminalDataMessage
  | TerminalExitMessage
  | TerminalErrorMessage;

/**
 * Terminal セッションIDのサフィックス
 * Claude WebSocketとの競合を避けるため、Terminal用のセッションIDにこのサフィックスを付加する
 */
const TERMINAL_SESSION_SUFFIX = '-terminal';

/**
 * ターミナルWebSocketサーバーをセットアップ
 *
 * WebSocket経由でPTY入出力を中継する。
 * セッションの実行環境設定に応じてアダプターを切り替える。
 *
 * @param wss - WebSocketサーバーインスタンス
 * @param _path - WebSocketパス（使用しない、互換性のため）
 */
export function setupTerminalWebSocket(
  wss: WebSocketServer,
  _path: string
): void {
  wss.on('connection', async (ws: WebSocket, req) => {
    // URLからセッションIDを取得
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const last = pathParts[pathParts.length - 1];
    const sessionId = last === 'terminal'
      ? pathParts[pathParts.length - 2]
      : last;

    // セッションID検証
    if (!sessionId || sessionId === '') {
      logger.warn('Terminal WebSocket: Session ID missing');
      ws.close(1008, 'Session ID required');
      return;
    }

    // セッション存在確認
    try {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sessionId),
      });

      if (!session) {
        logger.warn('Terminal WebSocket: Session not found', { sessionId });
        ws.close(1008, 'Session not found');
        return;
      }

      // Terminal用のセッションIDを生成（Claude PTYとの競合を避けるため）
      // Claude WebSocketは sessionId を使用し、Terminal WebSocketは sessionId + TERMINAL_SESSION_SUFFIX を使用
      const terminalSessionId = `${sessionId}${TERMINAL_SESSION_SUFFIX}`;

      // アダプター選択
      // environment_idがある場合は新方式（AdapterFactory経由）
      // ない場合は従来のptyManagerを直接使用
      let adapter: EnvironmentAdapter | null = null;
      let useLegacyPtyManager = true;

      if (session.environment_id) {
        // 新方式: environment_id で環境を取得
        const environment = await environmentService.findById(session.environment_id);
        if (!environment) {
          logger.error('Terminal WebSocket: Environment not found', {
            sessionId,
            environmentId: session.environment_id,
          });
          const errorMsg: TerminalErrorMessage = {
            type: 'error',
            message: `Environment not found: ${session.environment_id}`,
          };
          ws.send(JSON.stringify(errorMsg));
          ws.close(1008, 'Environment not found');
          return;
        }
        adapter = AdapterFactory.getAdapter(environment);
        useLegacyPtyManager = false;
        logger.info('Terminal WebSocket: Using adapter for environment', {
          sessionId,
          environmentId: environment.id,
          environmentType: environment.type,
        });
      } else {
        // 従来方式: ptyManagerを直接使用
        logger.info('Terminal WebSocket: Using legacy ptyManager', { sessionId });
      }

      // PTY作成（既に存在する場合はスキップ）
      const hasSession = useLegacyPtyManager
        ? ptyManager.hasSession(terminalSessionId)
        : adapter!.hasSession(terminalSessionId);

      if (!hasSession) {
        try {
          if (useLegacyPtyManager) {
            ptyManager.createPTY(terminalSessionId, session.worktree_path);
          } else {
            // アダプター経由でシェルセッションを作成
            await adapter!.createSession(terminalSessionId, session.worktree_path, undefined, {
              shellMode: true,
            });
          }
          logger.info('Terminal PTY created for session', {
            sessionId,
            terminalSessionId,
            worktreePath: session.worktree_path,
            useLegacyPtyManager,
          });
        } catch (ptyError) {
          // PTY作成エラーをクライアントに通知
          const errorMessage = ptyError instanceof Error ? ptyError.message : 'Failed to create PTY';
          logger.error('Terminal WebSocket: Failed to create PTY', {
            sessionId,
            error: errorMessage,
            worktreePath: session.worktree_path,
          });

          // クライアントにエラーメッセージを送信
          const errorMsg: TerminalErrorMessage = {
            type: 'error',
            message: `PTY creation failed: ${errorMessage}`,
          };
          ws.send(JSON.stringify(errorMsg));
          // コード1000で閉じることで、クライアントが再接続を試みないようにする
          ws.close(1000, 'PTY creation failed');
          return;
        }
      }

      // イベントハンドラー定義
      // アダプター用
      const adapterDataHandler = (sid: string, data: string) => {
        if (sid === terminalSessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const adapterExitHandler = (sid: string, info: AdapterPTYExitInfo) => {
        if (sid === terminalSessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalExitMessage = {
            type: 'exit',
            exitCode: info.exitCode,
            signal: info.signal ?? null,
          };
          ws.send(JSON.stringify(message));
          ws.close();
        }
      };

      const adapterErrorHandler = (sid: string, error: Error) => {
        if (sid === terminalSessionId && ws.readyState === WebSocket.OPEN) {
          logger.error('Terminal WebSocket: Adapter error', {
            sessionId,
            terminalSessionId,
            error: error.message,
          });
          const message: TerminalErrorMessage = {
            type: 'error',
            message: `Terminal error: ${error.message}`,
          };
          ws.send(JSON.stringify(message));
        }
      };

      // レガシー用（ptyManager）
      const legacyDataHandler = (sid: string, data: string) => {
        if (sid === terminalSessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const legacyExitHandler = (
        sid: string,
        { exitCode, signal }: PTYExitInfo
      ) => {
        if (sid === terminalSessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalExitMessage = {
            type: 'exit',
            exitCode,
            signal: signal ?? null,
          };
          ws.send(JSON.stringify(message));
          ws.close();
        }
      };

      // イベントハンドラー登録
      if (useLegacyPtyManager) {
        ptyManager.on('data', legacyDataHandler);
        ptyManager.on('exit', legacyExitHandler);
      } else {
        adapter!.on('data', adapterDataHandler);
        adapter!.on('exit', adapterExitHandler);
        adapter!.on('error', adapterErrorHandler);
      }

      // WebSocket入力 → PTY
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          // メッセージ型の検証
          if (!data || typeof data !== 'object' || !data.type) {
            logger.warn('Terminal WebSocket: Invalid message format', {
              sessionId,
            });
            return;
          }

          if (data.type === 'input') {
            if (typeof data.data !== 'string') {
              logger.warn('Terminal WebSocket: Invalid input data type', {
                sessionId,
              });
              return;
            }
            if (useLegacyPtyManager) {
              ptyManager.write(terminalSessionId, data.data);
            } else {
              adapter!.write(terminalSessionId, data.data);
            }
          } else if (data.type === 'resize') {
            // resize データの検証
            if (
              !data.data ||
              typeof data.data.cols !== 'number' ||
              typeof data.data.rows !== 'number' ||
              !Number.isFinite(data.data.cols) ||
              !Number.isFinite(data.data.rows) ||
              data.data.cols <= 0 ||
              data.data.rows <= 0 ||
              data.data.cols > 1000 ||
              data.data.rows > 1000
            ) {
              logger.warn('Terminal WebSocket: Invalid resize dimensions', {
                sessionId,
                cols: data.data?.cols,
                rows: data.data?.rows,
              });
              return;
            }
            if (useLegacyPtyManager) {
              ptyManager.resize(terminalSessionId, data.data.cols, data.data.rows);
            } else {
              adapter!.resize(terminalSessionId, data.data.cols, data.data.rows);
            }
          } else {
            logger.warn('Terminal WebSocket: Unknown message type', {
              sessionId,
              type: data.type,
            });
          }
        } catch (error) {
          logger.error('Terminal WebSocket: Failed to parse message', {
            sessionId,
            error,
          });
        }
      });

      // クリーンアップ
      ws.on('close', () => {
        // イベントハンドラー解除
        if (useLegacyPtyManager) {
          ptyManager.off('data', legacyDataHandler);
          ptyManager.off('exit', legacyExitHandler);
          // PTYプロセスを終了
          if (ptyManager.hasSession(terminalSessionId)) {
            ptyManager.kill(terminalSessionId);
          }
        } else {
          adapter!.off('data', adapterDataHandler);
          adapter!.off('exit', adapterExitHandler);
          adapter!.off('error', adapterErrorHandler);
          // アダプター経由でセッション終了
          if (adapter!.hasSession(terminalSessionId)) {
            adapter!.destroySession(terminalSessionId);
          }
        }
        logger.info('Terminal WebSocket connection closed', { sessionId, terminalSessionId });
      });

      logger.info('Terminal WebSocket connection established', { sessionId });
    } catch (error) {
      logger.error('Terminal WebSocket: Error during connection setup', {
        sessionId,
        error,
      });
      ws.close(1011, 'Internal server error');
    }
  });
}
