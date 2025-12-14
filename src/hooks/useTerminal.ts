/**
 * ターミナルWebSocket接続フック
 * タスク6.7: ターミナル統合(フロントエンド)実装
 *
 * 機能:
 * - XTerm.jsターミナルの初期化
 * - PTYバックエンドとのWebSocket接続
 * - ターミナル入出力の中継
 * - リサイズ対応
 * - 接続状態の管理
 *
 * @param sessionId - セッションID
 * @returns ターミナルインスタンス、接続状態、fitメソッド
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface UseTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  fit: () => void;
}

export function useTerminal(sessionId: string): UseTerminalReturn {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // ターミナルインスタンスを作成
    const terminal = new Terminal({
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
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // WebSocket URLを構築
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws/sessions/${sessionId}/terminal`;

    // WebSocket接続を作成
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 接続成功時
    ws.onopen = () => {
      setIsConnected(true);
      // 初期リサイズメッセージを送信
      if (terminal.cols && terminal.rows) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            rows: terminal.rows,
            cols: terminal.cols,
          })
        );
      }
    };

    // メッセージ受信時
    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'output') {
          // ターミナルに出力を書き込む
          terminal.write(message.data);
        } else if (message.type === 'exit') {
          // プロセス終了メッセージを表示
          terminal.write(`\r\n[Process exited with code ${message.code}]\r\n`);
          // WebSocketを切断
          ws.close();
        }
      } catch (error) {
        console.error('Failed to parse terminal WebSocket message:', error);
      }
    };

    // 接続切断時
    ws.onclose = () => {
      setIsConnected(false);
    };

    // エラー発生時
    ws.onerror = (error: Event) => {
      console.error('Terminal WebSocket error:', error);
      setIsConnected(false);
    };

    // ターミナル入力 → WebSocket
    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'input',
            data,
          })
        );
      }
    });

    // クリーンアップ
    return () => {
      terminal.dispose();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [sessionId]);

  // リサイズ関数
  const fit = () => {
    if (fitAddonRef.current && wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
      fitAddonRef.current.fit();
      const terminal = terminalRef.current;
      wsRef.current.send(
        JSON.stringify({
          type: 'resize',
          rows: terminal.rows,
          cols: terminal.cols,
        })
      );
    }
  };

  return {
    terminal: terminalRef.current,
    isConnected,
    fit,
  };
}
