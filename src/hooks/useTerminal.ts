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
 * - 自動再接続（異常切断時）
 * - 手動再接続
 *
 * @param sessionId - セッションID
 * @returns ターミナルインスタンス、接続状態、fit/reconnectメソッド
 */

import { useEffect, useRef, useState, useCallback } from 'react';
// 静的インポート（動的インポートは開発モードでwebpackチャンク問題を引き起こすため）
// Note: このhookは 'use client' コンポーネントでのみ使用され、
// useEffect内でブラウザ環境チェックを行うため安全
import { Terminal, type IDisposable } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface UseTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  fit: () => void;
  reconnect: () => void;
  error: string | null;
}

// 再接続の設定
const RECONNECT_DELAY = 1000; // 再接続までの待機時間（ミリ秒）
const MAX_RECONNECT_ATTEMPTS = 5; // 最大再接続試行回数

export function useTerminal(sessionId: string): UseTerminalReturn {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);

  // WebSocket接続を作成する関数
  const createWebSocket = useCallback(() => {
    if (!isMountedRef.current || typeof window === 'undefined') {
      return null;
    }

    // 既存の接続を閉じる
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      wsRef.current.close();
    }

    // WebSocket URLを構築
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/terminal/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 接続成功時
    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0; // 接続成功したらカウンタをリセット

      // 初期リサイズメッセージを送信
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

    // メッセージ受信時
    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'data') {
          // ターミナルに出力を書き込む
          terminalRef.current?.write(message.content);
        } else if (message.type === 'exit') {
          // プロセス終了メッセージを表示
          terminalRef.current?.write(`\r\n[Process exited with code ${message.exitCode}]\r\n`);
          // WebSocketを正常終了として切断
          ws.close(1000, 'Process exited');
        } else if (message.type === 'error') {
          // エラーメッセージを表示
          terminalRef.current?.write(`\r\n[Error: ${message.message}]\r\n`);
          setError(message.message);
        }
      } catch (err) {
        console.error('Failed to parse terminal WebSocket message:', err);
      }
    };

    // 接続切断時
    ws.onclose = (event: CloseEvent) => {
      if (!isMountedRef.current) return;
      setIsConnected(false);

      // 正常終了（コード1000）以外の場合は自動再接続を試みる
      if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`Terminal WebSocket disconnected unexpectedly, attempting reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

        // 再接続タイマーをセット
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            createWebSocket();
          }
        }, RECONNECT_DELAY);
      }
    };

    // エラー発生時
    ws.onerror = (err: Event) => {
      if (!isMountedRef.current) return;
      console.error('Terminal WebSocket error:', err);
      setIsConnected(false);
    };

    return ws;
  }, [sessionId]);

  // ターミナル初期化
  useEffect(() => {
    // ブラウザ環境でのみXTerm.jsをロード
    if (typeof window === 'undefined') {
      return;
    }

    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    const initTerminal = () => {
      try {
        // アンマウント後は処理を中断
        if (!isMountedRef.current) return;

        // ターミナルインスタンスを作成
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

        // FitAddonを追加
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;
        setTerminal(term);

        // ターミナル入力 → WebSocket
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

        // WebSocket接続を作成
        createWebSocket();
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Failed to initialize terminal:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
      }
    };

    initTerminal();

    // クリーンアップ
    return () => {
      isMountedRef.current = false;

      // 再接続タイマーをクリア
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (onDataDisposableRef.current) {
        onDataDisposableRef.current.dispose();
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
      setTerminal(null);
    };
  }, [sessionId, createWebSocket]);

  // リサイズ関数（useCallbackでメモ化して不要な再レンダリングを防止）
  const fit = useCallback(() => {
    if (fitAddonRef.current && wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
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

  // 手動再接続関数
  const reconnect = useCallback(() => {
    // 再接続カウンタをリセット
    reconnectAttemptsRef.current = 0;

    // 既存の再接続タイマーをクリア
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 新しい接続を作成
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
