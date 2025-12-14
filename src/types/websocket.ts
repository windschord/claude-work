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
export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
