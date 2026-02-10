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
  | { type: 'run_script_exit'; runId: string; exitCode: number | null; signal: string | null; executionTime: number }
  | { type: 'process_paused'; reason: ProcessPauseReason }
  | { type: 'process_resumed'; resumedWithHistory: boolean }
  | { type: 'server_shutdown'; signal: 'SIGTERM' | 'SIGINT' };

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
export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error' | 'stopped';

/**
 * プロセス一時停止理由
 */
export type ProcessPauseReason = 'idle_timeout' | 'manual' | 'server_shutdown';

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

/**
 * Claude WebSocket（/ws/claude/:id）メッセージ型定義
 */

// クライアント → サーバー（入力）
export interface ClaudeInputMessage {
  type: 'input';
  data: string;
}

// クライアント → サーバー（リサイズ）
export interface ClaudeResizeMessage {
  type: 'resize';
  data: {
    cols: number;
    rows: number;
  };
}

// クライアント → サーバー（再起動）
export interface ClaudeRestartMessage {
  type: 'restart';
}

// クライアント → サーバー（画像ペースト）
export interface ClaudePasteImageMessage {
  type: 'paste-image';
  data: string;      // base64エンコードされた画像データ
  mimeType: string;  // 'image/png', 'image/jpeg' 等
}

export type ClaudeClientMessage =
  | ClaudeInputMessage
  | ClaudeResizeMessage
  | ClaudeRestartMessage
  | ClaudePasteImageMessage;

// サーバー → クライアント（出力）
export interface ClaudeDataMessage {
  type: 'data';
  content: string;
}

// サーバー → クライアント（終了）
export interface ClaudeExitMessage {
  type: 'exit';
  exitCode: number;
  signal: number | null;
}

// サーバー → クライアント（エラー）
export interface ClaudeErrorMessage {
  type: 'error';
  message: string;
}

// サーバー → クライアント（画像保存結果）
export interface ClaudeImageSavedMessage {
  type: 'image-saved';
  filePath: string;
}

export interface ClaudeImageErrorMessage {
  type: 'image-error';
  message: string;
}

// サーバー → クライアント（スクロールバック復元）
export interface ClaudeScrollbackMessage {
  type: 'scrollback';
  content: string;
}

export type ClaudeServerMessage =
  | ClaudeDataMessage
  | ClaudeExitMessage
  | ClaudeErrorMessage
  | ClaudeImageSavedMessage
  | ClaudeImageErrorMessage
  | ClaudeScrollbackMessage;
