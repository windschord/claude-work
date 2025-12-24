/**
 * WebSocketメッセージ型定義
 * タスク4.2: WebSocketクライアント実装
 */

/**
 * クライアントからサーバーへ送信するメッセージ型
 */
export type ClientMessage =
  | { type: 'input'; content: string }
  | { type: 'approve'; requestId: string }
  | { type: 'deny'; requestId: string };

/**
 * サーバーからクライアントへ送信するメッセージ型
 */
export type ServerMessage =
  | { type: 'output'; content: string; subAgent?: SubAgent }
  | { type: 'permission_request'; permission: PermissionRequest }
  | { type: 'status_change'; status: SessionStatus }
  | { type: 'error'; content: string }
  | { type: 'run_script_log'; runId: string; level: 'info' | 'error'; content: string; timestamp: number }
  | { type: 'run_script_exit'; runId: string; exitCode: number | null; signal: string | null; executionTime: number };

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
export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';

/**
 * ProcessManagerイベントデータ型
 */
export interface ProcessManagerOutputEvent {
  sessionId: string;
  content: string;
  subAgent?: SubAgent;
}

export interface ProcessManagerPermissionEvent {
  sessionId: string;
  requestId: string;
  action: string;
  details: string;
}

export interface ProcessManagerErrorEvent {
  sessionId: string;
  content: string;
}

export interface ProcessManagerExitEvent {
  sessionId: string;
  exitCode: number;
}
