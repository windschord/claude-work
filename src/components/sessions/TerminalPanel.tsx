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
  const [isTerminalOpened, setIsTerminalOpened] = useState(false);

  // クライアントサイドでのみレンダリング
  useEffect(() => {
    setMounted(true);
  }, []);

  // ターミナルをDOMにマウント
  useEffect(() => {
    if (terminal && containerRef.current && mounted && !isTerminalOpened) {
      try {
        // コンテナが可視状態か確認
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        // サイズがある場合のみopen()を実行
        if (rect.width > 0 && rect.height > 0) {
          terminal.open(container);
          setIsTerminalOpened(true);

          // 初期リサイズ - DOMレンダリング完了後に実行
          requestAnimationFrame(() => {
            fit();
          });
        } else {
          // サイズがない場合は少し待ってから再試行
          const timer = setTimeout(() => {
            if (containerRef.current && terminal) {
              const newRect = containerRef.current.getBoundingClientRect();
              if (newRect.width > 0 && newRect.height > 0) {
                terminal.open(containerRef.current);
                setIsTerminalOpened(true);
                requestAnimationFrame(() => {
                  fit();
                });
              }
            }
          }, 100);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error('Failed to open terminal:', err);
      }
    }
  }, [terminal, fit, mounted, isTerminalOpened]);

  // ウィンドウリサイズ時にターミナルをリサイズ
  useEffect(() => {
    if (!mounted || !isTerminalOpened) return;

    const handleResize = () => {
      fit();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fit, mounted, isTerminalOpened]);

  // 表示状態が変わった時にリサイズ（IntersectionObserver使用）
  useEffect(() => {
    if (!mounted || !isTerminalOpened || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 表示されたらリサイズ
            requestAnimationFrame(() => {
              fit();
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [fit, mounted, isTerminalOpened]);

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
      <div
        ref={containerRef}
        className="flex-1 p-2 min-h-0"
        role="application"
        aria-label="Terminal"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
