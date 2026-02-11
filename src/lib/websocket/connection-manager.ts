import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../logger';
import { ServerMessage } from '@/types/websocket';
import { ScrollbackBuffer } from '@/services/scrollback-buffer';
import { performance } from 'node:perf_hooks';

/**
 * WebSocket接続を管理するクラス
 *
 * セッションIDごとに複数のWebSocket接続を管理し、
 * メッセージのブロードキャスト機能を提供します。
 *
 * EventEmitterを継承し、以下のイベントを発火します：
 * - allConnectionsClosed(sessionId): 最後の接続が切断された時
 */
export class ConnectionManager extends EventEmitter {
  private connections: Map<string, Set<WebSocket>>;
  private scrollbackBuffers: Map<string, ScrollbackBuffer> = new Map();
  private eventHandlers: Map<string, Map<string, Function>> = new Map();
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesDropped: 0,
  };

  constructor() {
    super();
    this.connections = new Map();
  }

  /**
   * 接続を追加
   *
   * 指定されたセッションIDに新しいWebSocket接続を追加します。
   * 同じセッションに複数のクライアントが接続できます。
   * エラー/クローズハンドラーを設定し、スクロールバックバッファを送信します。
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

    // メトリクス更新
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    logger.info('WebSocket connection added', {
      sessionId,
      totalConnections: sessionConnections.size,
    });

    // 接続エラー/クローズのハンドラー設定
    ws.on('error', () => this.handleConnectionError(sessionId, ws));
    ws.on('close', () => this.removeConnection(sessionId, ws));

    // スクロールバックバッファを送信
    this.sendScrollbackToConnection(sessionId, ws);
  }

  /**
   * 接続エラーハンドラー
   *
   * @param sessionId - セッションID
   * @param ws - WebSocketインスタンス
   */
  private handleConnectionError(sessionId: string, ws: WebSocket): void {
    logger.error('WebSocket error for session', { sessionId });
    this.removeConnection(sessionId, ws);
  }

  /**
   * 接続を削除
   *
   * 指定されたセッションIDから特定のWebSocket接続を削除します。
   * セッションに接続がなくなった場合、セッションエントリも削除され、
   * allConnectionsClosedイベントが発火されます。
   *
   * @param sessionId - セッションID
   * @param ws - WebSocketインスタンス
   */
  removeConnection(sessionId: string, ws: WebSocket): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections) {
      logger.warn('No connection pool for session', { sessionId });
      return;
    }

    const removed = sessionConnections.delete(ws);
    if (removed) {
      this.metrics.activeConnections--;
      logger.debug('Connection removed from session', {
        sessionId,
        remaining: sessionConnections.size,
      });
    }

    if (sessionConnections.size === 0) {
      // allConnectionsClosedイベントを発火
      this.emit('allConnectionsClosed', sessionId);

      // 接続プールとハンドラーをクリーンアップ
      this.connections.delete(sessionId);
      this.eventHandlers.delete(sessionId);
      this.scrollbackBuffers.delete(sessionId);

      logger.info('All connections closed for session', { sessionId });
    } else {
      logger.info('WebSocket connection removed', {
        sessionId,
        remainingConnections: sessionConnections.size,
      });
    }
  }

  /**
   * メッセージをブロードキャスト（string | Buffer版）
   *
   * 指定されたセッションIDに接続されている全てのクライアントに
   * メッセージを送信します。送信失敗した接続は自動的に削除されます。
   *
   * @param sessionId - セッションID
   * @param message - 送信するメッセージ（string または Buffer）
   */
  broadcast(sessionId: string, message: string | Buffer | ServerMessage): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections || sessionConnections.size === 0) {
      logger.warn('No active connections for session', { sessionId });
      return;
    }

    const startTime = performance.now();
    let successCount = 0;
    let failureCount = 0;

    // ServerMessageの場合はJSON文字列に変換（後方互換性）
    const actualMessage =
      typeof message === 'object' && 'type' in message
        ? JSON.stringify(message)
        : message;

    // 全接続に送信
    for (const ws of sessionConnections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(actualMessage);
          successCount++;
        } else {
          logger.warn('WebSocket not open for session', {
            sessionId,
            state: ws.readyState,
          });
          failureCount++;
        }
      } catch (error) {
        logger.error('Failed to send message to connection', { error });
        failureCount++;
        this.metrics.messagesDropped++;
      }
    }

    const duration = performance.now() - startTime;
    this.metrics.messagesSent += successCount;

    // パフォーマンス監視（NFR-PERF-001: < 100ms）
    if (duration > 100) {
      logger.warn('Broadcast took too long', {
        sessionId,
        duration,
        connections: sessionConnections.size,
      });
    }

    logger.debug('Broadcast to session', {
      sessionId,
      sent: successCount,
      failed: failureCount,
      duration,
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

  /**
   * 接続のSetを取得
   *
   * 指定されたセッションIDの接続のSetを返します。
   * 存在しない場合は空のSetを返します。
   *
   * @param sessionId - セッションID
   * @returns 接続のSet
   */
  getConnections(sessionId: string): Set<WebSocket> {
    return this.connections.get(sessionId) ?? new Set();
  }

  /**
   * 接続があるか確認
   *
   * 指定されたセッションIDに接続があるか確認します。
   *
   * @param sessionId - セッションID
   * @returns 接続があればtrue
   */
  hasConnections(sessionId: string): boolean {
    const pool = this.connections.get(sessionId);
    return pool !== undefined && pool.size > 0;
  }

  /**
   * 単一の接続にメッセージを送信
   *
   * 指定されたWebSocket接続にメッセージを送信します。
   * 接続がOPEN状態でない場合は送信しません。
   *
   * @param ws - WebSocketインスタンス
   * @param message - 送信するメッセージ（string または Buffer）
   */
  sendToConnection(ws: WebSocket, message: string | Buffer): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        logger.debug('WebSocket not open, skipping send', {
          state: ws.readyState,
        });
      }
    } catch (error) {
      logger.error('Failed to send message to connection', { error });
      this.metrics.messagesDropped++;
    }
  }

  /**
   * スクロールバックバッファを設定
   *
   * 指定されたセッションIDにスクロールバックバッファを設定します。
   *
   * @param sessionId - セッションID
   * @param buffer - ScrollbackBufferインスタンス
   */
  setScrollbackBuffer(sessionId: string, buffer: ScrollbackBuffer): void {
    this.scrollbackBuffers.set(sessionId, buffer);
    logger.debug('Scrollback buffer set for session', { sessionId });
  }

  /**
   * スクロールバックバッファを接続に送信
   *
   * 新規接続に対してスクロールバックバッファを送信します。
   *
   * @param sessionId - セッションID
   * @param ws - WebSocketインスタンス
   */
  sendScrollbackToConnection(sessionId: string, ws: WebSocket): void {
    const buffer = this.scrollbackBuffers.get(sessionId);
    if (!buffer) {
      logger.debug('No scrollback buffer for session', { sessionId });
      return;
    }

    try {
      const content = buffer.getBuffer(sessionId);
      if (content && ws.readyState === WebSocket.OPEN) {
        ws.send(content);
        logger.debug('Sent scrollback buffer to connection', {
          sessionId,
          bytes: content.length,
        });
      }
    } catch (error) {
      logger.error('Failed to send scrollback buffer', { sessionId, error });
    }
  }

  /**
   * イベントハンドラーを登録
   *
   * PTYのイベントハンドラーをセッション単位で登録します。
   * 同じイベントに複数回登録すると警告を出して上書きします。
   *
   * @param sessionId - セッションID
   * @param eventName - イベント名
   * @param handler - ハンドラー関数
   */
  registerHandler(
    sessionId: string,
    eventName: string,
    handler: Function
  ): void {
    if (!this.eventHandlers.has(sessionId)) {
      this.eventHandlers.set(sessionId, new Map());
    }

    const handlers = this.eventHandlers.get(sessionId)!;

    if (handlers.has(eventName)) {
      logger.warn('Handler already registered, overwriting', {
        sessionId,
        eventName,
      });
    }

    handlers.set(eventName, handler);
    logger.debug('Registered event handler', { sessionId, eventName });
  }

  /**
   * イベントハンドラーを削除
   *
   * 指定されたセッションIDとイベント名のハンドラーを削除します。
   *
   * @param sessionId - セッションID
   * @param eventName - イベント名
   */
  unregisterHandler(sessionId: string, eventName: string): void {
    const handlers = this.eventHandlers.get(sessionId);
    if (!handlers) {
      return;
    }

    handlers.delete(eventName);
    logger.debug('Unregistered event handler', { sessionId, eventName });

    if (handlers.size === 0) {
      this.eventHandlers.delete(sessionId);
    }
  }

  /**
   * ハンドラーが登録されているか確認
   *
   * 指定されたセッションIDとイベント名のハンドラーが存在するか確認します。
   *
   * @param sessionId - セッションID
   * @param eventName - イベント名
   * @returns ハンドラーが存在すればtrue
   */
  hasHandler(sessionId: string, eventName: string): boolean {
    const handlers = this.eventHandlers.get(sessionId);
    return handlers?.has(eventName) ?? false;
  }

  /**
   * セッションのクリーンアップ
   *
   * 指定されたセッションIDの接続プール、ハンドラー、バッファを削除します。
   *
   * @param sessionId - セッションID
   */
  cleanup(sessionId: string): void {
    this.connections.delete(sessionId);
    this.eventHandlers.delete(sessionId);
    this.scrollbackBuffers.delete(sessionId);
    logger.info('Session cleaned up', { sessionId });
  }

  /**
   * メトリクスを取得
   *
   * 現在のメトリクスのスナップショットを返します。
   *
   * @returns メトリクス
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }
}

/**
 * 接続メトリクス
 */
export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  messagesDropped: number;
}
