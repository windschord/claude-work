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
    // タイマー参照を保持（クリーンアップ用）
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // コンポーネントがアンマウントされたかどうかを追跡
    let isMounted = true;

    const tryOpenTerminal = () => {
      if (!isMounted || !terminal || !containerRef.current || isTerminalOpened) {
        return;
      }

      try {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        // サイズがある場合のみopen()を実行
        if (rect.width > 0 && rect.height > 0) {
          terminal.open(container);
          setIsTerminalOpened(true);

          // 初期リサイズ - DOMレンダリング完了後に実行
          requestAnimationFrame(() => {
            if (isMounted) {
              fit();
            }
          });
        } else {
          // サイズがない場合は少し待ってから再試行
          retryTimer = setTimeout(tryOpenTerminal, 100);
        }
      } catch (err) {
        console.error('Failed to open terminal:', err);
      }
    };

    if (terminal && containerRef.current && mounted && !isTerminalOpened) {
      tryOpenTerminal();
    }

    // クリーンアップ: タイマーとマウント状態をクリア
    return () => {
      isMounted = false;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
    };
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
    // エフェクト実行時のcontainerRef.currentをキャプチャ
    // これにより、クリーンアップ時に正しい要素をunobserveできる
    const container = containerRef.current;
    if (!mounted || !isTerminalOpened || !container) return;

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

    observer.observe(container);

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
        className="flex-1 p-2 min-h-0 w-full h-full"
        role="application"
        aria-label="Terminal"
      />
    </div>
  );
}
