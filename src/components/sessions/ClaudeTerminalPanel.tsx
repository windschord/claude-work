/**
 * Claude Codeターミナルパネルコンポーネント
 *
 * XTerm.jsを使用したClaude Code専用ターミナルUIを提供します。
 * - Claude Codeとの対話的なターミナル表示
 * - 接続状態インジケーター
 * - 再起動機能
 * - 自動リサイズ
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useClaudeTerminal } from '@/hooks/useClaudeTerminal';
import { RotateCcw } from 'lucide-react';

// xterm CSSはuseEffect内で動的にロード（SSRを避けるため）

interface ClaudeTerminalPanelProps {
  sessionId: string;
  isVisible: boolean;
}

function ClaudeTerminalPanel({
  sessionId,
  isVisible,
}: ClaudeTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminal, isConnected, fit, restart, reconnect, error } =
    useClaudeTerminal(sessionId);
  const [mounted, setMounted] = useState(false);
  const [isTerminalOpened, setIsTerminalOpened] = useState(false);
  // 前回のターミナルインスタンスを追跡
  const prevTerminalRef = useRef<typeof terminal>(null);

  // クライアントサイドでのみレンダリング & CSS動的ロード
  useEffect(() => {
    setMounted(true);
    // xterm CSSを動的にインポート（SSRを避けるため）
    // @ts-expect-error - CSSモジュールの動的インポートは型定義がない
    void import('@xterm/xterm/css/xterm.css').catch((err: unknown) => {
      console.error('Failed to load xterm CSS:', err);
    });
  }, []);

  // ターミナルインスタンスが変わったらisTerminalOpenedをリセット
  // これによりセッション切り替え時に新しいターミナルが正しくopen()される
  useEffect(() => {
    if (terminal !== prevTerminalRef.current) {
      // ターミナルインスタンスが変わった場合、isTerminalOpenedをリセット
      if (prevTerminalRef.current !== null) {
        setIsTerminalOpened(false);
      }
      prevTerminalRef.current = terminal;
    }
  }, [terminal]);

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
          // ターミナルが既にDOMにアタッチされているかチェック
          // XTerm.jsのTerminalはelement プロパティでアタッチ状態を確認できる
           
          const terminalElement = (terminal as any).element;
          if (terminalElement) {
            setIsTerminalOpened(true);
            return;
          }

          // 新しいターミナルを開く前にコンテナをクリア
          // これにより、前のセッションのターミナル残骸が除去される
          container.innerHTML = '';
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
        console.error('Failed to open Claude terminal:', err);
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

  // 表示状態が変わった時にリサイズ
  useEffect(() => {
    if (!mounted || !isTerminalOpened || !isVisible) return;

    // 表示されたらリサイズ
    requestAnimationFrame(() => {
      fit();
    });
  }, [fit, mounted, isTerminalOpened, isVisible]);

  // 表示状態が変わった時にリサイズ（IntersectionObserver使用）
  useEffect(() => {
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
      <div
        className={`h-full flex flex-col items-center justify-center ${
          isVisible ? '' : 'hidden'
        }`}
      >
        <p className="text-gray-500 dark:text-gray-400">Loading Claude Code...</p>
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div className={`h-full flex flex-col ${isVisible ? '' : 'hidden'}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Claude Code
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-semibold mb-2">
              Failed to initialize Claude terminal
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isVisible ? '' : 'hidden'}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Claude Code
        </h3>
        <div className="flex items-center gap-3">
          {/* 再接続ボタン（切断時のみ表示） */}
          {!isConnected && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
              title="Reconnect to Server"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reconnect</span>
            </button>
          )}
          {/* 再起動ボタン */}
          <button
            onClick={restart}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Restart Claude Code"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </button>
          {/* 接続状態 */}
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
      </div>

      {/* ターミナルエリア */}
      <div
        ref={containerRef}
        className="flex-1 p-2 min-h-0 w-full h-full"
        role="application"
        aria-label="Claude Code Terminal"
      />
    </div>
  );
}

// Named export for backward compatibility
export { ClaudeTerminalPanel };

// Default export for dynamic import
export default ClaudeTerminalPanel;
