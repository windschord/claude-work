import { WebSocket, WebSocketServer } from 'ws';
import { ptyManager, type PTYExitInfo } from '@/services/pty-manager';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

type TerminalClientMessage = TerminalInputMessage | TerminalResizeMessage;

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


/**
 * ターミナルWebSocketサーバーをセットアップ
 *
 * WebSocket経由でPTY入出力を中継する。
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
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        logger.warn('Terminal WebSocket: Session not found', { sessionId });
        ws.close(1008, 'Session not found');
        return;
      }

      // PTY作成（既に存在する場合はスキップ）
      if (!ptyManager.hasSession(sessionId)) {
        ptyManager.createPTY(sessionId, session.worktree_path);
        logger.info('PTY created for session', { sessionId });
      }

      // PTY出力 → WebSocket
      const dataHandler = (sid: string, data: string) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const exitHandler = (
        sid: string,
        { exitCode, signal }: PTYExitInfo
      ) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: TerminalExitMessage = {
            type: 'exit',
            exitCode,
            signal: signal ?? null,
          };
          ws.send(JSON.stringify(message));
          ws.close();
        }
      };

      ptyManager.on('data', dataHandler);
      ptyManager.on('exit', exitHandler);

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
            ptyManager.write(sessionId, data.data);
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
            ptyManager.resize(sessionId, data.data.cols, data.data.rows);
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
        ptyManager.off('data', dataHandler);
        ptyManager.off('exit', exitHandler);
        // PTYプロセスを終了
        if (ptyManager.hasSession(sessionId)) {
          ptyManager.kill(sessionId);
        }
        logger.info('Terminal WebSocket connection closed', { sessionId });
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
