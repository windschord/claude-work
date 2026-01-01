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
 * - 自動再接続（異常切断時）
 * - 手動再接続
 *
 * @param sessionId - セッションID
 * @returns ターミナルインスタンス、接続状態、fit/restart/reconnectメソッド
 */

import { useEffect, useRef, useState, useCallback } from 'react';
// xterm.jsはブラウザ専用のため、useEffect内で動的インポートする
// 型のみ静的インポート（実行時には影響しない）
import type { Terminal, IDisposable } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export interface UseClaudeTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  fit: () => void;
  restart: () => void;
  reconnect: () => void;
  error: string | null;
}

// 再接続の設定
const RECONNECT_DELAY = 1000; // 再接続までの待機時間（ミリ秒）
const MAX_RECONNECT_ATTEMPTS = 5; // 最大再接続試行回数

export function useClaudeTerminal(sessionId: string): UseClaudeTerminalReturn {
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

    // WebSocket URLを構築（Claude Code用エンドポイント）
    // NOTE: window.location.hostを使用してポート番号を含める（開発環境での異なるポートに対応）
    // 本番環境でリバースプロキシを使用する場合は、Hostヘッダーが正しく設定されていることを確認してください。
    // ホストヘッダーインジェクション攻撃を防ぐため、サーバー側で許可されたホストを検証してください。
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/claude/${sessionId}`;

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
          terminalRef.current?.write(
            `\r\n[Claude Code exited with code ${message.exitCode}]\r\n`
          );
          terminalRef.current?.write('[Click Restart button to restart Claude Code]\r\n');
          // 接続は維持（再起動可能にするため）
        } else if (message.type === 'error') {
          // エラーメッセージを表示
          terminalRef.current?.write(`\r\n[Error: ${message.message}]\r\n`);
          setError(message.message);
        }
      } catch (err) {
        console.error('Failed to parse Claude WebSocket message:', err);
      }
    };

    // 接続切断時
    ws.onclose = (event: CloseEvent) => {
      if (!isMountedRef.current) return;
      setIsConnected(false);

      // 正常終了（コード1000）以外の場合は自動再接続を試みる
      if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`Claude WebSocket disconnected unexpectedly, attempting reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

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
      console.error('Claude WebSocket error:', err);
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

    const initTerminal = async () => {
      try {
        // アンマウント後は処理を中断
        if (!isMountedRef.current) return;

        // xterm.jsを動的インポート（ブラウザ専用ライブラリ）
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ]);

        // アンマウント後は処理を中断（非同期インポート後の再チェック）
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
        console.error('Failed to initialize Claude terminal:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to initialize terminal'
        );
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

  // 手動再接続関数
  const reconnect = useCallback(() => {
    // 再接続カウンタをリセット
    reconnectAttemptsRef.current = 0;

    // 既存の再接続タイマーをクリア
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // ターミナルに再接続メッセージを表示
    if (terminalRef.current) {
      terminalRef.current.write('\r\n[Reconnecting to server...]\r\n');
    }

    // 新しい接続を作成
    createWebSocket();
  }, [createWebSocket]);

  // 再起動関数
  const restart = useCallback(() => {
    // WebSocketが接続されている場合は再起動メッセージを送信
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
    } else {
      // WebSocketが切断されている場合は、まず再接続してから再起動
      if (terminalRef.current) {
        terminalRef.current.write('\r\n[Reconnecting and restarting Claude Code...]\r\n');
      }

      // 再接続カウンタをリセット
      reconnectAttemptsRef.current = 0;

      // 既存の再接続タイマーをクリア
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // 新しい接続を作成
      createWebSocket();
    }
  }, [createWebSocket]);

  return {
    terminal,
    isConnected,
    fit,
    restart,
    reconnect,
    error,
  };
}
