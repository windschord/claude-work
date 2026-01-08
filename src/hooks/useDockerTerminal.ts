/**
 * Docker Session Terminal WebSocket Hook
 *
 * Docker session用のターミナル接続フック。
 * /ws/session/:id エンドポイントに接続してターミナルI/Oを中継する。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Terminal, IDisposable } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export interface UseDockerTerminalOptions {
  isVisible?: boolean;
}

export interface UseDockerTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  fit: () => void;
  reconnect: () => void;
  error: string | null;
}

const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RESIZE_DEBOUNCE_DELAY = 300;
const INIT_DEBOUNCE_DELAY = 100;

export function useDockerTerminal(
  sessionId: string,
  options: UseDockerTerminalOptions = {}
): UseDockerTerminalReturn {
  const { isVisible = true } = options;
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const isInitializingRef = useRef(false);
  const prevIsVisibleRef = useRef(isVisible);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);

  const createWebSocket = useCallback(() => {
    if (!isMountedRef.current || typeof window === 'undefined') {
      return null;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Docker session用のエンドポイント: /ws/session/:id
    const wsUrl = `${protocol}//${host}/ws/session/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      if (terminalRef.current?.cols && terminalRef.current?.rows) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            data: {
              cols: terminalRef.current.cols,
              rows: terminalRef.current.rows,
            },
          })
        );
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'data') {
          terminalRef.current?.write(message.content);
        } else if (message.type === 'exit') {
          terminalRef.current?.write(
            `\r\n[Process exited with code ${message.exitCode}]\r\n`
          );
          ws.close(1000, 'Process exited');
        } else if (message.type === 'error') {
          terminalRef.current?.write(`\r\n[Error: ${message.message}]\r\n`);
          setError(message.message);
        }
      } catch (err) {
        console.error('Failed to parse Docker session WebSocket message:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (!isMountedRef.current) return;
      setIsConnected(false);

      if (
        event.code !== 1000 &&
        reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttemptsRef.current++;
        console.log(
          `Docker session WebSocket disconnected unexpectedly, attempting reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
        );

        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            createWebSocket();
          }
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = (err: Event) => {
      if (!isMountedRef.current) return;
      console.error('Docker session WebSocket error:', err);
      setIsConnected(false);
    };

    return ws;
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isInitializingRef.current) {
      return;
    }

    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    const initTerminal = async () => {
      try {
        if (!isMountedRef.current) return;

        isInitializingRef.current = true;

        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ]);

        if (!isMountedRef.current) return;

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
          },
          cols: 80,
          rows: 24,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;
        setTerminal(term);

        const onDataDisposable = term.onData((data: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'input',
                data,
              })
            );
          }
        });
        onDataDisposableRef.current = onDataDisposable;

        createWebSocket();
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Failed to initialize Docker terminal:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to initialize terminal'
        );
      } finally {
        isInitializingRef.current = false;
      }
    };

    initTimerRef.current = setTimeout(() => {
      initTerminal();
    }, INIT_DEBOUNCE_DELAY);

    return () => {
      isMountedRef.current = false;

      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
        initTimerRef.current = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }

      if (onDataDisposableRef.current) {
        onDataDisposableRef.current.dispose();
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        wsRef.current.close();
      }
      setTerminal(null);

      isInitializingRef.current = false;
    };
  }, [sessionId, createWebSocket]);

  const fit = useCallback(() => {
    if (
      fitAddonRef.current &&
      wsRef.current?.readyState === WebSocket.OPEN &&
      terminalRef.current
    ) {
      fitAddonRef.current.fit();
      const term = terminalRef.current;
      wsRef.current.send(
        JSON.stringify({
          type: 'resize',
          data: {
            cols: term.cols,
            rows: term.rows,
          },
        })
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = setTimeout(() => {
        fit();
      }, RESIZE_DEBOUNCE_DELAY);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    };
  }, [fit]);

  useEffect(() => {
    if (isVisible && !prevIsVisibleRef.current) {
      fit();
    }
    prevIsVisibleRef.current = isVisible;
  }, [isVisible, fit]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    createWebSocket();
  }, [createWebSocket]);

  return {
    terminal,
    isConnected,
    fit,
    reconnect,
    error,
  };
}
