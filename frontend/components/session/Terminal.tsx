'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Terminal as XTerminal } from 'xterm';
import type { FitAddon } from '@xterm/addon-fit';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface TerminalProps {
  sessionId: string;
}

// XTerm.jsの動的インポート（ブラウザ専用）
const TerminalComponent = dynamic(
  () => Promise.resolve(TerminalInner),
  { ssr: false }
);

function TerminalInner({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket接続とターミナル初期化
  useEffect(() => {
    let mounted = true;

    const initTerminal = async () => {
      if (!terminalRef.current || !mounted) return;

      try {
        // XTerm.jsとfit addonを動的インポート
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('@xterm/addon-fit');

        // ターミナルインスタンスを作成
        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5',
          },
          scrollback: 1000,
        });

        // Fit addonを追加
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        // ターミナルをDOMにマウント
        terminal.open(terminalRef.current);
        xtermRef.current = terminal;

        // サイズを調整
        fitAddon.fit();

        // WebSocket接続
        const ws = new WebSocket(`${WS_URL}/ws/sessions/${sessionId}/terminal`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          setIsConnected(true);
          setError(null);
          terminal.writeln('ターミナルに接続しました。');

          // 初期サイズを送信
          ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows,
          }));
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'output':
                // 出力をターミナルに書き込み
                terminal.write(message.data);
                break;
              case 'exit':
                // プロセス終了
                terminal.writeln(`\r\nプロセスが終了しました (code: ${message.code})`);
                break;
              default:
                console.warn('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Failed to parse terminal message:', error);
          }
        };

        ws.onerror = () => {
          if (!mounted) return;
          setError('ターミナル接続エラーが発生しました');
        };

        ws.onclose = () => {
          if (!mounted) return;
          setIsConnected(false);
          terminal.writeln('\r\nターミナル接続が切断されました。');
        };

        // ターミナルからの入力をWebSocketに送信
        terminal.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'input',
              data,
            }));
          }
        });

        // リサイズハンドラー
        const handleResize = () => {
          if (fitAddon && terminal) {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'resize',
                cols: terminal.cols,
                rows: terminal.rows,
              }));
            }
          }
        };

        // リサイズイベントリスナーを追加
        window.addEventListener('resize', handleResize);

        // クリーンアップ関数を返す
        return () => {
          window.removeEventListener('resize', handleResize);
          ws.close();
          terminal.dispose();
        };
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        if (mounted) {
          setError('ターミナルの初期化に失敗しました');
        }
      }
    };

    const cleanup = initTerminal();

    return () => {
      mounted = false;
      cleanup?.then((cleanupFn) => cleanupFn?.());
    };
  }, [sessionId]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-300">
            {isConnected ? '接続済み' : '切断'}
          </span>
        </div>
        {error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>

      {/* ターミナル本体 */}
      <div className="flex-1 p-2 overflow-hidden">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  );
}

export default function Terminal(props: TerminalProps) {
  return <TerminalComponent {...props} />;
}
