/**
 * Claude CodeターミナルWebSocket接続フック
 *
 * 機能:
 * - XTerm.jsターミナルの初期化
 * - Claude Code PTYバックエンドとのWebSocket接続
 * - ターミナル入出力の中継
 * - リサイズ対応
 * - 接続状態の管理
 * - 再起動機能
 *
 * @param sessionId - セッションID
 * @returns ターミナルインスタンス、接続状態、fit/restartメソッド
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { IDisposable } from '@xterm/xterm';

export interface UseClaudeTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  fit: () => void;
  restart: () => void;
  error: string | null;
}

export function useClaudeTerminal(sessionId: string): UseClaudeTerminalReturn {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);

  useEffect(() => {
    // ブラウザ環境でのみXTerm.jsをロード
    if (typeof window === 'undefined') {
      return;
    }

    let isMounted = true;
    let terminal: Terminal;
    let fitAddon: FitAddon;
    let ws: WebSocket;

    const initTerminal = async () => {
      try {
        // 動的インポートでXTerm.jsとFitAddonを読み込む
        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');

        // アンマウント後は処理を中断
        if (!isMounted) return;

        // ターミナルインスタンスを作成
        terminal = new Terminal({
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

        // FitAddonを追加
        fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        setTerminal(terminal);

        // WebSocket URLを構築（Claude Code用エンドポイント）
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/claude/${sessionId}`;

        // WebSocket接続を作成
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // 接続成功時
        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          setError(null);
          // 初期リサイズメッセージを送信
          if (terminal.cols && terminal.rows) {
            ws.send(
              JSON.stringify({
                type: 'resize',
                data: {
                  cols: terminal.cols,
                  rows: terminal.rows,
                },
              })
            );
          }
        };

        // メッセージ受信時
        ws.onmessage = (event: MessageEvent) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'data') {
              // ターミナルに出力を書き込む
              terminal.write(message.content);
            } else if (message.type === 'exit') {
              // プロセス終了メッセージを表示
              terminal.write(
                `\r\n[Claude Code exited with code ${message.exitCode}]\r\n`
              );
              terminal.write('[Type "restart" command or click restart button to restart]\r\n');
              // 接続は維持（再起動可能にするため）
            } else if (message.type === 'error') {
              // エラーメッセージを表示
              terminal.write(`\r\n[Error: ${message.message}]\r\n`);
              setError(message.message);
            }
          } catch (error) {
            console.error('Failed to parse Claude WebSocket message:', error);
          }
        };

        // 接続切断時
        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
        };

        // エラー発生時
        ws.onerror = (error: Event) => {
          if (!isMounted) return;
          console.error('Claude WebSocket error:', error);
          setIsConnected(false);
          setError('WebSocket connection error');
        };

        // ターミナル入力 → WebSocket
        const onDataDisposable = terminal.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'input',
                data,
              })
            );
          }
        });
        onDataDisposableRef.current = onDataDisposable;
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to initialize Claude terminal:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to initialize terminal'
        );
      }
    };

    initTerminal();

    // クリーンアップ
    return () => {
      isMounted = false;
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
    };
  }, [sessionId]);

  // リサイズ関数（useCallbackでメモ化して不要な再レンダリングを防止）
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

  // 再起動関数
  const restart = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'restart',
        })
      );
      // ターミナルに再起動メッセージを表示
      if (terminalRef.current) {
        terminalRef.current.write('\r\n[Restarting Claude Code...]\r\n');
      }
    }
  }, []);

  return {
    terminal,
    isConnected,
    fit,
    restart,
    error,
  };
}
