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

import { useEffect, useRef, useState } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  sessionId: string;
}

export function TerminalPanel({ sessionId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminal, isConnected, fit, error } = useTerminal(sessionId);
  const [mounted, setMounted] = useState(false);

  // クライアントサイドでのみレンダリング
  useEffect(() => {
    setMounted(true);
  }, []);

  // ターミナルをDOMにマウント
  useEffect(() => {
    if (terminal && containerRef.current && mounted) {
      try {
        terminal.open(containerRef.current);
        // 初期リサイズ - DOMレンダリング完了後に実行
        requestAnimationFrame(() => {
          fit();
        });
      } catch (err) {
        console.error('Failed to open terminal:', err);
      }
    }
  }, [terminal, fit, mounted]);

  // ウィンドウリサイズ時にターミナルをリサイズ
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      fit();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fit, mounted]);

  // SSR時は何も表示しない
  if (!mounted) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading terminal...</p>
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Terminal</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-semibold mb-2">Failed to initialize terminal</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

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
