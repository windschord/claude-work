import { WebSocket, WebSocketServer } from 'ws';
import { ptyManager, type PTYExitInfo } from '@/services/pty-manager';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { environmentService } from '@/services/environment-service';
import { AdapterFactory } from '@/services/adapter-factory';
import type { EnvironmentAdapter, PTYExitInfo as AdapterPTYExitInfo } from '@/services/environment-adapter';
import { ConnectionManager } from './connection-manager';

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
 * ConnectionManagerインスタンス（接続プール管理）
 * Claude WebSocketと同じインスタンスを共有して統一的な接続管理を行う
 */
const connectionManager = ConnectionManager.getInstance();

/**
 * PTY破棄タイマー管理
 * ターミナルセッションは30秒の猶予期間でPTYを破棄
 * （Claude WebSocketの5分より短い）
 */
const PTY_DESTROY_GRACE_PERIOD = 30000; // 30 seconds
const destroyTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
  // 接続が全て切断された時のイベントハンドラー
  connectionManager.on('allConnectionsClosed', (terminalSessionId: string) => {
    // Terminal用セッションIDのみを処理（Claude WebSocket側のイベントを無視）
    if (!terminalSessionId.endsWith(TERMINAL_SESSION_SUFFIX)) {
      return;
    }

    // 破棄タイマーを開始（30秒後にPTYを破棄）
    const timer = setTimeout(() => {
      // セッションIDからサフィックスを除去して元のセッションIDを取得
      const originalSessionId = terminalSessionId.replace(TERMINAL_SESSION_SUFFIX, '');

      logger.info('Terminal WebSocket: Destroying PTY after grace period', {
        sessionId: originalSessionId,
        terminalSessionId,
        gracePeriod: PTY_DESTROY_GRACE_PERIOD,
      });

      // セッション情報を取得してアダプター選択
      db.query.sessions.findFirst({
        where: eq(schema.sessions.id, originalSessionId),
        with: {
          project: {
            columns: {
              environment_id: true,
            },
          },
        },
      }).then((session) => {
        if (!session) {
          logger.warn('Terminal WebSocket: Session not found for cleanup', {
            sessionId: originalSessionId,
          });
          return;
        }

        // イベントハンドラーを取得して解除
        const dataHandler = connectionManager.hasHandler(terminalSessionId, 'data');
        const exitHandler = connectionManager.hasHandler(terminalSessionId, 'exit');
        const errorHandler = connectionManager.hasHandler(terminalSessionId, 'error');

        if (session.project?.environment_id) {
          // 新方式: AdapterFactory経由
          environmentService.findById(session.project.environment_id).then(async (environment) => {
            if (environment) {
              const adapter = AdapterFactory.getAdapter(environment);

              // イベントハンドラー解除（adapter側のリスナーも削除）
              if (dataHandler) {
                const handler = connectionManager.getHandler(terminalSessionId, 'data');
                if (handler) {
                  adapter.off('data', handler);
                }
                connectionManager.unregisterHandler(terminalSessionId, 'data');
              }
              if (exitHandler) {
                const handler = connectionManager.getHandler(terminalSessionId, 'exit');
                if (handler) {
                  adapter.off('exit', handler);
                }
                connectionManager.unregisterHandler(terminalSessionId, 'exit');
              }
              if (errorHandler) {
                const handler = connectionManager.getHandler(terminalSessionId, 'error');
                if (handler) {
                  adapter.off('error', handler);
                }
                connectionManager.unregisterHandler(terminalSessionId, 'error');
              }

              // PTY破棄
              if (adapter.hasSession(terminalSessionId)) {
                await adapter.destroySession(terminalSessionId);
              }
            }
          }).catch((error) => {
            logger.error('Failed to cleanup terminal session via environment adapter', {
              sessionId: terminalSessionId,
              error,
            });
          });
        } else {
          // 従来方式: ptyManager直接使用
          // イベントハンドラー解除（ptyManager側のリスナーも削除）
          if (dataHandler) {
            const handler = connectionManager.getHandler(terminalSessionId, 'data');
            if (handler) {
              ptyManager.off('data', handler);
            }
            connectionManager.unregisterHandler(terminalSessionId, 'data');
          }
          if (exitHandler) {
            const handler = connectionManager.getHandler(terminalSessionId, 'exit');
            if (handler) {
              ptyManager.off('exit', handler);
            }
            connectionManager.unregisterHandler(terminalSessionId, 'exit');
          }
          if (errorHandler) {
            const handler = connectionManager.getHandler(terminalSessionId, 'error');
            if (handler) {
              ptyManager.off('error', handler);
            }
            connectionManager.unregisterHandler(terminalSessionId, 'error');
          }

          // PTY破棄
          if (ptyManager.hasSession(terminalSessionId)) {
            ptyManager.kill(terminalSessionId);
          }
        }
      });

      destroyTimers.delete(terminalSessionId);
    }, PTY_DESTROY_GRACE_PERIOD);

    destroyTimers.set(terminalSessionId, timer);
  });

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
        with: {
          project: {
            columns: {
              environment_id: true,
            },
          },
        },
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

      if (session.project?.environment_id) {
        // 新方式: プロジェクトのenvironment_id で環境を取得
        const environment = await environmentService.findById(session.project.environment_id);
        if (!environment) {
          logger.error('Terminal WebSocket: Environment not found', {
            sessionId,
            environmentId: session.project.environment_id,
          });
          const errorMsg: TerminalErrorMessage = {
            type: 'error',
            message: `Environment not found: ${session.project.environment_id}`,
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

      // イベントハンドラー定義
      // アダプター用
      const adapterDataHandler = (sid: string, data: string) => {
        if (sid === terminalSessionId) {
          try {
            const message: TerminalDataMessage = {
              type: 'data',
              content: data,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast data', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      const adapterExitHandler = (sid: string, info: AdapterPTYExitInfo) => {
        if (sid === terminalSessionId) {
          try {
            const message: TerminalExitMessage = {
              type: 'exit',
              exitCode: info.exitCode,
              signal: info.signal ?? null,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
            connectionManager.closeAllConnections(terminalSessionId);
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast exit', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      const adapterErrorHandler = (sid: string, error: Error) => {
        if (sid === terminalSessionId) {
          logger.error('Terminal WebSocket: Adapter error', {
            sessionId,
            terminalSessionId,
            error: error.message,
          });
          try {
            const message: TerminalErrorMessage = {
              type: 'error',
              message: `Terminal error: ${error.message}`,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast error message', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      // レガシー用（ptyManager）
      const legacyDataHandler = (sid: string, data: string) => {
        if (sid === terminalSessionId) {
          try {
            const message: TerminalDataMessage = {
              type: 'data',
              content: data,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast legacy data', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      const legacyExitHandler = (
        sid: string,
        { exitCode, signal }: PTYExitInfo
      ) => {
        if (sid === terminalSessionId) {
          try {
            const message: TerminalExitMessage = {
              type: 'exit',
              exitCode,
              signal: signal ?? null,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
            connectionManager.closeAllConnections(terminalSessionId);
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast legacy exit', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      const legacyErrorHandler = (sid: string, error: Error) => {
        if (sid === terminalSessionId) {
          logger.error('Terminal WebSocket: Legacy PTY error', {
            sessionId,
            terminalSessionId,
            error: error.message,
          });
          try {
            const message: TerminalErrorMessage = {
              type: 'error',
              message: error.message,
            };
            connectionManager.broadcast(terminalSessionId, JSON.stringify(message));
          } catch (err) {
            logger.error('Terminal WebSocket: Failed to broadcast legacy error', {
              sessionId, terminalSessionId,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      };

      // イベントハンドラー登録（初回接続時のみ）
      // createSession前にerrorハンドラーを登録することで、セッション作成中の
      // EventEmitter 'error'イベント（リスナーなしでプロセスクラッシュ）を防止する
      let handlersRegistered = false;
      if (!connectionManager.hasHandler(terminalSessionId, 'data')) {
        if (useLegacyPtyManager) {
          ptyManager.on('data', legacyDataHandler);
          ptyManager.on('exit', legacyExitHandler);
          ptyManager.on('error', legacyErrorHandler);
          connectionManager.registerHandler(terminalSessionId, 'data', legacyDataHandler);
          connectionManager.registerHandler(terminalSessionId, 'exit', legacyExitHandler);
          connectionManager.registerHandler(terminalSessionId, 'error', legacyErrorHandler);
        } else {
          adapter!.on('data', adapterDataHandler);
          adapter!.on('exit', adapterExitHandler);
          adapter!.on('error', adapterErrorHandler);
          connectionManager.registerHandler(terminalSessionId, 'data', adapterDataHandler);
          connectionManager.registerHandler(terminalSessionId, 'exit', adapterExitHandler);
          connectionManager.registerHandler(terminalSessionId, 'error', adapterErrorHandler);
        }
        handlersRegistered = true;
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

          // createSession前に登録したハンドラーをクリーンアップ
          if (handlersRegistered) {
            if (useLegacyPtyManager) {
              ptyManager.off('data', legacyDataHandler);
              ptyManager.off('exit', legacyExitHandler);
              ptyManager.off('error', legacyErrorHandler);
            } else {
              adapter!.off('data', adapterDataHandler);
              adapter!.off('exit', adapterExitHandler);
              adapter!.off('error', adapterErrorHandler);
            }
            connectionManager.unregisterHandler(terminalSessionId, 'data');
            connectionManager.unregisterHandler(terminalSessionId, 'exit');
            if (!useLegacyPtyManager) {
              connectionManager.unregisterHandler(terminalSessionId, 'error');
            }
          }

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

      // ConnectionManagerに接続を追加
      connectionManager.addConnection(terminalSessionId, ws);

      // 破棄タイマーが存在する場合はキャンセル
      const existingTimer = destroyTimers.get(terminalSessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        destroyTimers.delete(terminalSessionId);
        logger.info('Terminal WebSocket: Cancelled PTY destroy timer', {
          sessionId,
          terminalSessionId,
        });
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
        // ConnectionManagerから接続を削除
        connectionManager.removeConnection(terminalSessionId, ws);
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
