/**
 * WebSocket接続管理フック（スタブ）
 * タスク4.2: WebSocketクライアント実装
 */

import type { ClientMessage, ServerMessage } from '@/types/websocket';

export interface UseWebSocketReturn {
  send: (message: ClientMessage) => void;
  disconnect: () => void;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function useWebSocket(
  sessionId: string,
  onMessage: (message: ServerMessage) => void
): UseWebSocketReturn {
  // スタブ実装（テスト失敗用）
  throw new Error('Not implemented');
}
