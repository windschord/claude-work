import { WebSocket } from 'ws';
import { ConnectionManager } from './connection-manager';
import { getRunScriptManager } from '../../services/run-script-manager';
import { getProcessLifecycleManager } from '../../services/process-lifecycle-manager';
import { logger } from '../logger';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import type {
  ClientMessage,
  ServerMessage,
  SessionStatus,
  ProcessPauseReason,
} from '@/types/websocket';

/**
 * セッション用WebSocketハンドラー
 *
 * WebSocket接続の処理、メッセージのルーティング、
 * RunScriptManagerとの統合を担当します。
 * Claude Codeとの通信はClaudeWebSocketHandler（/ws/claude/:id）で処理されます。
 */
export class SessionWebSocketHandler {
  private connectionManager: ConnectionManager;
  private runScriptManager: ReturnType<typeof getRunScriptManager>;
  private lifecycleManager: ReturnType<typeof getProcessLifecycleManager>;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.runScriptManager = getRunScriptManager();
    this.lifecycleManager = getProcessLifecycleManager();
    this.setupRunScriptManagerListeners();
    this.setupLifecycleManagerListeners();
  }

  /**
   * RunScriptManagerのイベントリスナーをセットアップ
   *
   * RunScriptManagerからのイベントをWebSocketメッセージに変換し、
   * クライアントにブロードキャストします。
   */
  private setupRunScriptManagerListeners(): void {
    // ランスクリプトの標準出力をブロードキャスト
    // Note: 'output'イベントは標準出力(stdout)専用。
    // 標準エラー出力(stderr)は別途'error'イベントで処理される。
    this.runScriptManager.on('output', (data: {
      runId: string;
      sessionId: string;
      type: 'stdout';
      content: string;
    }) => {
      const message: ServerMessage = {
        type: 'run_script_log',
        runId: data.runId,
        level: 'info',
        content: data.content,
        timestamp: Date.now(),
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });

    // ランスクリプトの標準エラー出力をブロードキャスト
    this.runScriptManager.on('error', (data: {
      runId: string;
      sessionId: string;
      content: string;
    }) => {
      const message: ServerMessage = {
        type: 'run_script_log',
        runId: data.runId,
        level: 'error',
        content: data.content,
        timestamp: Date.now(),
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });

    // ランスクリプトの終了をブロードキャスト
    this.runScriptManager.on('exit', (data: {
      runId: string;
      sessionId: string;
      exitCode: number | null;
      signal: string | null;
      executionTime: number;
    }) => {
      const message: ServerMessage = {
        type: 'run_script_exit',
        runId: data.runId,
        exitCode: data.exitCode,
        signal: data.signal,
        executionTime: data.executionTime,
      };
      this.connectionManager.broadcast(data.sessionId, message);
    });
  }

  /**
   * ProcessLifecycleManagerのイベントリスナーをセットアップ
   *
   * ライフサイクルイベントをWebSocketメッセージに変換し、
   * クライアントにブロードキャストします。
   */
  private setupLifecycleManagerListeners(): void {
    // プロセス一時停止をブロードキャスト
    this.lifecycleManager.on('processPaused', (sessionId: string, reason: ProcessPauseReason) => {
      const message: ServerMessage = {
        type: 'process_paused',
        reason,
      };
      this.connectionManager.broadcast(sessionId, message);

      // ステータス変更も通知
      const statusMessage: ServerMessage = {
        type: 'status_change',
        status: 'stopped',
      };
      this.connectionManager.broadcast(sessionId, statusMessage);
    });

    // プロセス再開をブロードキャスト
    this.lifecycleManager.on('processResumed', (sessionId: string, resumedWithHistory: boolean) => {
      const message: ServerMessage = {
        type: 'process_resumed',
        resumedWithHistory,
      };
      this.connectionManager.broadcast(sessionId, message);

      // ステータス変更も通知
      const statusMessage: ServerMessage = {
        type: 'status_change',
        status: 'running',
      };
      this.connectionManager.broadcast(sessionId, statusMessage);
    });

    // サーバーシャットダウンをブロードキャスト（全クライアントに通知）
    this.lifecycleManager.on('serverShutdown', (signal: 'SIGTERM' | 'SIGINT') => {
      const message: ServerMessage = {
        type: 'server_shutdown',
        signal,
      };
      this.connectionManager.broadcastAll(message);
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
  async handleConnection(ws: WebSocket, sessionId: string): Promise<void> {
    // 接続を登録
    this.connectionManager.addConnection(sessionId, ws);

    // アクティビティを更新（アイドルタイムアウトのリセット）
    this.lifecycleManager.updateActivity(sessionId);

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

    // データベースから実際のセッションステータスを取得
    try {
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sessionId),
        columns: { status: true },
      });

      const status = session?.status || 'error';

      const welcomeMessage: ServerMessage = {
        type: 'status_change',
        status: status as SessionStatus,
      };
      ws.send(JSON.stringify(welcomeMessage));
    } catch (error) {
      logger.error('Failed to fetch session status', { sessionId, error });
      const welcomeMessage: ServerMessage = {
        type: 'status_change',
        status: 'error',
      };
      ws.send(JSON.stringify(welcomeMessage));
    }
  }

  /**
   * クライアントからのメッセージを処理
   *
   * メッセージをパースし、タイプに応じて適切な処理を実行します。
   * 注意: Claude Codeへの入力はClaudeWebSocketHandler（/ws/claude/:id）で処理されます。
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

      // アクティビティを更新（アイドルタイムアウトのリセット）
      this.lifecycleManager.updateActivity(sessionId);

      logger.debug('WebSocket message received', {
        sessionId,
        messageType: message.type,
      });

      // このWebSocketはRunScriptログとライフサイクルイベント用
      // Claude Codeへの入力はClaudeWebSocketHandler（/ws/claude/:id）で処理
      logger.warn('Message type not handled on this endpoint', { sessionId, type: message.type });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Use /ws/claude/:sessionId for Claude Code input',
      };
      ws.send(JSON.stringify(errorMessage));
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        sessionId,
        error,
      });
      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Invalid message format',
      };
      ws.send(JSON.stringify(errorMessage));
    }
  }
}
