import { WebSocket } from 'ws';
import { ConnectionManager } from './connection-manager';
import { getProcessManager } from '../../services/process-manager';
import { logger } from '../logger';

/**
 * クライアントからサーバーへのメッセージ型定義
 */
export type ClientMessage =
  | { type: 'input'; content: string }
  | { type: 'approve'; requestId: string }
  | { type: 'deny'; requestId: string };

/**
 * サーバーからクライアントへのメッセージ型定義
 */
export type ServerMessage =
  | { type: 'output'; content: string; subAgent?: SubAgent }
  | { type: 'permission_request'; permission: PermissionRequest }
  | { type: 'status_change'; status: SessionStatus }
  | { type: 'error'; content: string };

/**
 * サブエージェント情報
 */
export interface SubAgent {
  name: string;
  output: string;
}

/**
 * 権限確認リクエスト
 */
export interface PermissionRequest {
  requestId: string;
  action: string;
  details: string;
}

/**
 * セッションステータス
 */
export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'waiting_input'
  | 'completed'
  | 'error';

/**
 * セッション用WebSocketハンドラー
 *
 * WebSocket接続の処理、メッセージのルーティング、
 * ProcessManagerとの統合を担当します。
 */
export class SessionWebSocketHandler {
  private connectionManager: ConnectionManager;
  private processManager: ReturnType<typeof getProcessManager>;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.processManager = getProcessManager();
    this.setupProcessManagerListeners();
  }

  /**
   * ProcessManagerのイベントリスナーをセットアップ
   *
   * ProcessManagerからのイベントをWebSocketメッセージに変換し、
   * クライアントにブロードキャストします。
   */
  private setupProcessManagerListeners(): void {
    // Claude Codeの出力をブロードキャスト
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processManager.on('output', (data: any) => {
      const message: ServerMessage = {
        type: 'output',
        content: data.content,
        subAgent: data.subAgent,
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });

    // 権限確認リクエストをブロードキャスト
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processManager.on('permission', (data: any) => {
      const message: ServerMessage = {
        type: 'permission_request',
        permission: {
          requestId: data.requestId,
          action: data.action,
          details: data.details,
        },
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });

    // エラーをブロードキャスト
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processManager.on('error', (data: any) => {
      const message: ServerMessage = {
        type: 'error',
        content: data.content,
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });

    // プロセス終了時にステータス変更を通知
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processManager.on('exit', (data: any) => {
      const message: ServerMessage = {
        type: 'status_change',
        status: data.exitCode === 0 ? 'completed' : 'error',
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });
  }

  /**
   * WebSocket接続を処理
   *
   * 新しいWebSocket接続を接続マネージャーに登録し、
   * メッセージハンドラーを設定します。
   *
   * @param ws - WebSocketインスタンス
   * @param sessionId - セッションID
   */
  handleConnection(ws: WebSocket, sessionId: string): void {
    // 接続を登録
    this.connectionManager.addConnection(sessionId, ws);

    logger.info('WebSocket connection established', { sessionId });

    // メッセージハンドラーを設定
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, sessionId, data);
    });

    // 切断ハンドラーを設定
    ws.on('close', () => {
      this.connectionManager.removeConnection(sessionId, ws);
      logger.info('WebSocket connection closed', { sessionId });
    });

    // エラーハンドラーを設定
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', { sessionId, error });
      this.connectionManager.removeConnection(sessionId, ws);
    });

    // 接続成功メッセージを送信
    const welcomeMessage: ServerMessage = {
      type: 'status_change',
      status: 'running',
    };
    ws.send(JSON.stringify(welcomeMessage));
  }

  /**
   * クライアントからのメッセージを処理
   *
   * メッセージをパースし、タイプに応じて適切な処理を実行します。
   *
   * @param ws - WebSocketインスタンス
   * @param sessionId - セッションID
   * @param data - 受信したメッセージデータ
   */
  private async handleMessage(
    ws: WebSocket,
    sessionId: string,
    data: Buffer
  ): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      logger.debug('WebSocket message received', {
        sessionId,
        messageType: message.type,
      });

      switch (message.type) {
        case 'input':
          await this.handleInputMessage(sessionId, message.content);
          break;

        case 'approve':
          await this.handleApproveMessage(sessionId, message.requestId);
          break;

        case 'deny':
          await this.handleDenyMessage(sessionId, message.requestId);
          break;

        default:
          logger.warn('Unknown message type', { sessionId, message });
          const errorMessage: ServerMessage = {
            type: 'error',
            content: 'Unknown message type',
          };
          ws.send(JSON.stringify(errorMessage));
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { sessionId, error });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Invalid message format',
      };
      ws.send(JSON.stringify(errorMessage));
    }
  }

  /**
   * 入力メッセージを処理
   *
   * ユーザーからの入力をProcessManagerに転送します。
   *
   * @param sessionId - セッションID
   * @param content - 入力内容
   */
  private async handleInputMessage(
    sessionId: string,
    content: string
  ): Promise<void> {
    try {
      await this.processManager.sendInput(sessionId, content);
      logger.info('Input sent to Claude Code', { sessionId });
    } catch (error) {
      logger.error('Failed to send input to Claude Code', { sessionId, error });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Failed to send input',
      };
      this.connectionManager.broadcast(sessionId, errorMessage);
    }
  }

  /**
   * 承認メッセージを処理
   *
   * 権限確認リクエストに対する承認をProcessManagerに転送します。
   *
   * @param sessionId - セッションID
   * @param requestId - リクエストID
   */
  private async handleApproveMessage(
    sessionId: string,
    requestId: string
  ): Promise<void> {
    try {
      await this.processManager.sendInput(sessionId, `approve:${requestId}`);
      logger.info('Approval sent to Claude Code', { sessionId, requestId });
    } catch (error) {
      logger.error('Failed to send approval to Claude Code', {
        sessionId,
        requestId,
        error,
      });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Failed to send approval',
      };
      this.connectionManager.broadcast(sessionId, errorMessage);
    }
  }

  /**
   * 拒否メッセージを処理
   *
   * 権限確認リクエストに対する拒否をProcessManagerに転送します。
   *
   * @param sessionId - セッションID
   * @param requestId - リクエストID
   */
  private async handleDenyMessage(
    sessionId: string,
    requestId: string
  ): Promise<void> {
    try {
      await this.processManager.sendInput(sessionId, `deny:${requestId}`);
      logger.info('Denial sent to Claude Code', { sessionId, requestId });
    } catch (error) {
      logger.error('Failed to send denial to Claude Code', {
        sessionId,
        requestId,
        error,
      });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Failed to send denial',
      };
      this.connectionManager.broadcast(sessionId, errorMessage);
    }
  }
}
