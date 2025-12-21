'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useScriptLogStore } from '@/store/script-logs';
import { Search, Filter, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface ScriptLogViewerProps {
  /** 表示する実行ID */
  runId: string;
}

/**
 * スクリプトログビューアーコンポーネント
 *
 * REQ-035: ログレベルフィルター機能
 * REQ-036: テキスト検索機能
 * REQ-037: 終了コードと実行時間の表示
 */
export function ScriptLogViewer({ runId }: ScriptLogViewerProps) {
  const runs = useScriptLogStore((state) => state.runs);
  const run = runs.get(runId);

  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'error'>('all');
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // ログをフィルタリング
  const filteredLogs = useMemo(() => {
    if (!run) return [];

    let logs = run.logs;

    // ログレベルフィルター
    if (levelFilter !== 'all') {
      logs = logs.filter((log) => log.level === levelFilter);
    }

    // テキスト検索
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      logs = logs.filter((log) => log.content.toLowerCase().includes(searchLower));
    }

    return logs;
  }, [run, levelFilter, searchText]);

  // 自動スクロール
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // 実行情報が存在しない場合
  if (!run) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>ログが見つかりません</p>
      </div>
    );
  }

  // 実行時間のフォーマット
  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー：スクリプト情報と実行状態 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {run.scriptName}
          </h3>
          {run.isRunning ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded dark:text-blue-300 dark:bg-blue-900">
              <Clock className="w-4 h-4 animate-spin" />
              実行中
            </span>
          ) : run.exitCode === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded dark:text-green-300 dark:bg-green-900">
              <CheckCircle className="w-4 h-4" />
              成功
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-700 bg-red-100 rounded dark:text-red-300 dark:bg-red-900">
              <AlertCircle className="w-4 h-4" />
              失敗
            </span>
          )}
        </div>

        {/* REQ-037: 終了コードと実行時間の表示 */}
        {!run.isRunning && (
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              終了コード: <span className="font-mono">{run.exitCode}</span>
            </div>
            {run.executionTime !== null && (
              <div>
                実行時間: <span className="font-mono">{formatExecutionTime(run.executionTime)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ツールバー：フィルターと検索 */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
        {/* REQ-035: ログレベルフィルター */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'all' | 'info' | 'error')}
            className="px-3 py-1 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="all">すべて</option>
            <option value="info">情報</option>
            <option value="error">エラー</option>
          </select>
        </div>

        {/* REQ-036: テキスト検索機能 */}
        <div className="flex items-center flex-1 gap-2">
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ログを検索..."
            className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {/* 自動スクロール切り替え */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          />
          自動スクロール
        </label>
      </div>

      {/* ログ表示エリア */}
      <div
        ref={logContainerRef}
        className="flex-1 p-4 overflow-auto font-mono text-sm bg-gray-50 dark:bg-gray-900"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>ログがありません</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`flex gap-4 ${
                  log.level === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                <span className="text-gray-500 dark:text-gray-500 shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold uppercase rounded shrink-0 ${
                    log.level === 'error'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}
                >
                  {log.level}
                </span>
                <pre className="whitespace-pre-wrap break-words">{log.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
