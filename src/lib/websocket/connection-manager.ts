import { WebSocket } from 'ws';
import { logger } from '../logger';
import { ServerMessage } from '@/types/websocket';

/**
 * WebSocket接続を管理するクラス
 *
 * セッションIDごとに複数のWebSocket接続を管理し、
 * メッセージのブロードキャスト機能を提供します。
 */
export class ConnectionManager {
  private connections: Map<string, Set<WebSocket>>;

  constructor() {
    this.connections = new Map();
  }

  /**
   * 接続を追加
   *
   * 指定されたセッションIDに新しいWebSocket接続を追加します。
   * 同じセッションに複数のクライアントが接続できます。
   *
   * @param sessionId - セッションID
   * @param ws - WebSocketインスタンス
   */
  addConnection(sessionId: string, ws: WebSocket): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    const sessionConnections = this.connections.get(sessionId)!;
    sessionConnections.add(ws);

    logger.info('WebSocket connection added', {
      sessionId,
      totalConnections: sessionConnections.size,
    });
  }

  /**
   * 接続を削除
   *
   * 指定されたセッションIDから特定のWebSocket接続を削除します。
   * セッションに接続がなくなった場合、セッションエントリも削除されます。
   *
   * @param sessionId - セッションID
   * @param ws - WebSocketインスタンス
   */
  removeConnection(sessionId: string, ws: WebSocket): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections) {
      return;
    }

    sessionConnections.delete(ws);

    if (sessionConnections.size === 0) {
      this.connections.delete(sessionId);
      logger.info('All connections closed for session', { sessionId });
    } else {
      logger.info('WebSocket connection removed', {
        sessionId,
        remainingConnections: sessionConnections.size,
      });
    }
  }

  /**
   * メッセージをブロードキャスト
   *
   * 指定されたセッションIDに接続されている全てのクライアントに
   * メッセージを送信します。送信失敗した接続は自動的に削除されます。
   *
   * @param sessionId - セッションID
   * @param message - 送信するメッセージ（ServerMessage型）
   */
  broadcast(sessionId: string, message: ServerMessage): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections || sessionConnections.size === 0) {
      logger.debug('No connections to broadcast', { sessionId });
      return;
    }

    const messageStr = JSON.stringify(message);
    const failedConnections: WebSocket[] = [];

    sessionConnections.forEach((ws) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        } else {
          // 接続が閉じている場合は削除リストに追加
          failedConnections.push(ws);
        }
      } catch (error) {
        logger.error('Failed to send message to WebSocket', {
          sessionId,
          error,
        });
        failedConnections.push(ws);
      }
    });

    // 失敗した接続を削除
    failedConnections.forEach((ws) => {
      this.removeConnection(sessionId, ws);
    });

    logger.debug('Message broadcasted', {
      sessionId,
      recipientCount: sessionConnections.size - failedConnections.length,
      messageType: message.type,
    });
  }

  /**
   * 全クライアントにメッセージをブロードキャスト
   *
   * 全てのセッションの全てのクライアントにメッセージを送信します。
   * サーバーシャットダウン通知などグローバルなイベントに使用します。
   *
   * @param message - 送信するメッセージ（ServerMessage型）
   */
  broadcastAll(message: ServerMessage): void {
    const messageStr = JSON.stringify(message);
    let totalSent = 0;

    this.connections.forEach((sessionConnections, sessionId) => {
      sessionConnections.forEach((ws) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
            totalSent++;
          }
        } catch (error) {
          logger.error('Failed to send message to WebSocket', {
            sessionId,
            error,
          });
        }
      });
    });

    logger.info('Message broadcasted to all clients', {
      recipientCount: totalSent,
      messageType: message.type,
    });
  }

  /**
   * セッションの接続数を取得
   *
   * 指定されたセッションIDに接続されているクライアント数を返します。
   *
   * @param sessionId - セッションID
   * @returns 接続数
   */
  getConnectionCount(sessionId: string): number {
    const sessionConnections = this.connections.get(sessionId);
    return sessionConnections ? sessionConnections.size : 0;
  }

  /**
   * 全セッションの接続を取得（デバッグ用）
   *
   * @returns 全セッションのマップのコピー
   */
  getAllConnections(): Map<string, Set<WebSocket>> {
    return new Map(this.connections);
  }

  /**
   * セッションの接続を全て切断
   *
   * 指定されたセッションIDの全ての接続を切断し、削除します。
   *
   * @param sessionId - セッションID
   */
  closeAllConnections(sessionId: string): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections) {
      return;
    }

    sessionConnections.forEach((ws) => {
      try {
        ws.close(1000, 'Session ended');
      } catch (error) {
        logger.error('Failed to close WebSocket', { sessionId, error });
      }
    });

    this.connections.delete(sessionId);
    logger.info('All connections closed for session', { sessionId });
  }
}
