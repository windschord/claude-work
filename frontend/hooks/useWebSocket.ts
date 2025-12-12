'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketMessage, WebSocketClientMessage } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface UseWebSocketOptions {
  sessionId: string;
  onMessage: (message: WebSocketMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  sendMessage: (message: WebSocketClientMessage) => void;
  disconnect: () => void;
  connect: () => void;
}

export function useWebSocket({
  sessionId,
  onMessage,
  onConnectionChange,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  const enabledRef = useRef(enabled);

  // Update enabled ref when prop changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }

    // Already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnecting(true);
    shouldReconnectRef.current = true;

    try {
      const ws = new WebSocket(`${WS_URL}/ws/sessions/${sessionId}`);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        onConnectionChange?.(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        onConnectionChange?.(false);

        // Auto reconnect with exponential backoff if enabled and should reconnect
        if (enabledRef.current && shouldReconnectRef.current && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Error handling - onclose will be called after onerror
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, [sessionId, reconnectAttempts, isConnecting, onMessage, onConnectionChange]);

  const sendMessage = useCallback((message: WebSocketClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  }, []);

  // Effect for automatic connection when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempts,
    sendMessage,
    disconnect,
    connect,
  };
}
