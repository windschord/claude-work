/**
 * WebSocket接続管理フック
 * タスク4.2: WebSocketクライアント実装
 *
 * 機能:
 * - WebSocket接続の確立と管理
 * - 自動再接続（最大5回、指数バックオフ）
 * - メッセージ送受信
 * - 接続状態の管理
 *
 * @param sessionId - セッションID
 * @param onMessage - メッセージ受信時のコールバック
 * @returns WebSocket操作関数と接続状態
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage } from '@/types/websocket';

export interface UseWebSocketReturn {
  send: (message: ClientMessage) => void;
  disconnect: () => void;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocket(
  sessionId: string,
  onMessage: (message: ServerMessage) => void
): UseWebSocketReturn {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  // WebSocket接続を確立する関数
  const connect = useCallback(() => {
    try {
      // 既存の接続があればクローズ
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }

      // WebSocket URLを構築
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/sessions/${sessionId}`;

      // WebSocket接続を作成
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 接続成功時
      ws.onopen = () => {
        setStatus('connected');
        reconnectCountRef.current = 0; // 再接続カウントをリセット
      };

      // メッセージ受信時
      ws.onmessage = (event: MessageEvent) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      // 接続切断時
      ws.onclose = (_event: CloseEvent) => {
        wsRef.current = null;

        // 手動切断の場合は再接続しない
        if (!shouldReconnectRef.current) {
          setStatus('disconnected');
          return;
        }

        // 最大再接続回数を超えた場合
        if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setStatus('error');
          return;
        }

        // disconnectedステータスに設定
        setStatus('disconnected');

        // 指数バックオフで再接続
        const delay = 1000 * Math.pow(2, reconnectCountRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current) {
            setStatus('connecting');
            reconnectCountRef.current += 1; // 再接続試行時にカウントをインクリメント
            connect();
          }
        }, delay);
      };

      // エラー発生時
      ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // メッセージ送信関数
  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }, []);

  // 切断関数
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    // 再接続タイマーをクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // WebSocket接続を切断
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // マウント時に接続、アンマウント時に切断
  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;

      // 再接続タイマーをクリア
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // WebSocket接続を切断
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    send,
    disconnect,
    status,
  };
}
