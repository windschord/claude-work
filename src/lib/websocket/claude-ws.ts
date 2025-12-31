import { WebSocket, WebSocketServer } from 'ws';
import {
  claudePtyManager,
  type ClaudePTYExitInfo,
} from '@/services/claude-pty-manager';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Claude Code WebSocketメッセージ型定義
 */

// クライアント → サーバー（入力）
interface ClaudeInputMessage {
  type: 'input';
  data: string;
}

// クライアント → サーバー（リサイズ）
interface ClaudeResizeMessage {
  type: 'resize';
  data: {
    cols: number;
    rows: number;
  };
}

// クライアント → サーバー（再起動）
interface ClaudeRestartMessage {
  type: 'restart';
}

export type ClaudeClientMessage =
  | ClaudeInputMessage
  | ClaudeResizeMessage
  | ClaudeRestartMessage;

// サーバー → クライアント（出力）
interface ClaudeDataMessage {
  type: 'data';
  content: string;
}

// サーバー → クライアント（終了）
interface ClaudeExitMessage {
  type: 'exit';
  exitCode: number;
  signal: number | null;
}

// サーバー → クライアント（エラー）
interface ClaudeErrorMessage {
  type: 'error';
  message: string;
}

export type ClaudeServerMessage =
  | ClaudeDataMessage
  | ClaudeExitMessage
  | ClaudeErrorMessage;

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
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        logger.warn('Claude WebSocket: Session not found', { sessionId });
        ws.close(1008, 'Session not found');
        return;
      }

      // Claude PTY作成（既に存在する場合はスキップ）
      if (!claudePtyManager.hasSession(sessionId)) {
        claudePtyManager.createSession(sessionId, session.worktree_path);
        logger.info('Claude PTY created for session', { sessionId });
      }

      // PTY出力 → WebSocket
      const dataHandler = (sid: string, data: string) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      };

      const exitHandler = (sid: string, { exitCode, signal }: ClaudePTYExitInfo) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeExitMessage = {
            type: 'exit',
            exitCode,
            signal: signal ?? null,
          };
          ws.send(JSON.stringify(message));
          // Claude Codeが終了しても接続は維持（再起動可能にするため）
        }
      };

      const errorHandler = (sid: string, error: Error) => {
        if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
          const message: ClaudeErrorMessage = {
            type: 'error',
            message: error.message,
          };
          ws.send(JSON.stringify(message));
        }
      };

      claudePtyManager.on('data', dataHandler);
      claudePtyManager.on('exit', exitHandler);
      claudePtyManager.on('error', errorHandler);

      // WebSocket入力 → PTY
      ws.on('message', (message: Buffer) => {
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
            claudePtyManager.write(sessionId, data.data);
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
              logger.warn('Claude WebSocket: Invalid resize dimensions', {
                sessionId,
                cols: data.data?.cols,
                rows: data.data?.rows,
              });
              return;
            }
            claudePtyManager.resize(sessionId, data.data.cols, data.data.rows);
          } else if (data.type === 'restart') {
            // Claude Codeプロセスを再起動
            logger.info('Claude WebSocket: Restarting Claude Code', {
              sessionId,
            });
            claudePtyManager.restartSession(sessionId);
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
        claudePtyManager.off('data', dataHandler);
        claudePtyManager.off('exit', exitHandler);
        claudePtyManager.off('error', errorHandler);
        // WebSocket切断時はClaude PTYを終了
        if (claudePtyManager.hasSession(sessionId)) {
          claudePtyManager.destroySession(sessionId);
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
