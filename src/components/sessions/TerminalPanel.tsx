/**
 * ターミナルパネルコンポーネント
 * タスク6.7: ターミナル統合(フロントエンド)実装
 *
 * XTerm.jsを使用したターミナルUIを提供します。
 * - ターミナル表示
 * - 接続状態インジケーター
 * - 自動リサイズ
 */

'use client';

import { useEffect, useRef } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  sessionId: string;
}

export function TerminalPanel({ sessionId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminal, isConnected, fit } = useTerminal(sessionId);

  // ターミナルをDOMにマウント
  useEffect(() => {
    if (terminal && containerRef.current) {
      terminal.open(containerRef.current);
      // 初期リサイズ
      fit();
    }
  }, [terminal, fit]);

  // ウィンドウリサイズ時にターミナルをリサイズ
  useEffect(() => {
    const handleResize = () => {
      fit();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fit]);

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Terminal</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* ターミナルエリア */}
      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
