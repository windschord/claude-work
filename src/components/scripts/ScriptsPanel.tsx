'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRunScriptStore } from '@/store/run-scripts';
import { useScriptLogStore } from '@/store/script-logs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScriptLogViewer } from './ScriptLogViewer';
import { Play, Square, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ServerMessage } from '@/types/websocket';

interface ScriptsPanelProps {
  /** セッションID */
  sessionId: string;
  /** プロジェクトID */
  projectId: string;
}

/**
 * スクリプト管理パネル
 *
 * スクリプト一覧、実行・停止ボタン、ログ表示を統合したコンポーネント
 */
export function ScriptsPanel({ sessionId, projectId }: ScriptsPanelProps) {
  const { scripts, fetchScripts, isLoading } = useRunScriptStore();
  const { runs, startRun, addLog, endRun } = useScriptLogStore();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // WebSocketメッセージハンドラー
  const handleWebSocketMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === 'run_script_log') {
        addLog(message.runId, {
          timestamp: message.timestamp,
          level: message.level,
          content: message.content,
        });
      } else if (message.type === 'run_script_exit') {
        endRun(
          message.runId,
          message.exitCode,
          message.signal,
          message.executionTime
        );
      }
    },
    [addLog, endRun]
  );

  // WebSocket接続（ログ受信用）
  useWebSocket(sessionId, handleWebSocketMessage);

  // スクリプト一覧を取得
  useEffect(() => {
    fetchScripts(projectId);
  }, [projectId, fetchScripts]);

  // スクリプト実行
  const handleRunScript = async (scriptId: string, scriptName: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scriptId }),
      });

      if (!response.ok) {
        throw new Error('スクリプトの実行に失敗しました');
      }

      const { runId } = await response.json();

      // ストアに実行開始を記録
      startRun(runId, scriptId, scriptName);
      setSelectedRunId(runId);
      toast.success(`スクリプト「${scriptName}」を実行しました`);
    } catch (error) {
      console.error('Failed to run script:', error);
      toast.error(
        error instanceof Error ? error.message : 'スクリプトの実行に失敗しました'
      );
    }
  };

  // スクリプト停止
  const handleStopScript = async (runId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/run/${runId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('スクリプトの停止に失敗しました');
      }

      toast.success('スクリプトを停止しました');
    } catch (error) {
      console.error('Failed to stop script:', error);
      toast.error(
        error instanceof Error ? error.message : 'スクリプトの停止に失敗しました'
      );
    }
  };

  // 実行中のrunIdを取得
  const getRunIdForScript = (scriptId: string): string | null => {
    for (const [runId, run] of runs) {
      if (run.scriptId === scriptId && run.isRunning) {
        return runId;
      }
    }
    return null;
  };

  return (
    <div className="flex h-full">
      {/* スクリプト一覧 */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            ランスクリプト
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>スクリプトが登録されていません</p>
            <p className="mt-2 text-sm">プロジェクト設定から追加してください</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {scripts.map((script) => {
              const runId = getRunIdForScript(script.id);
              const isRunning = runId !== null;

              return (
                <div
                  key={script.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {script.name}
                      </h3>
                      {script.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {script.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-500 truncate">
                        {script.command}
                      </p>
                    </div>

                    {isRunning ? (
                      <button
                        onClick={() => runId && handleStopScript(runId)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-red-500 rounded hover:bg-red-600 transition-colors shrink-0"
                      >
                        <Square className="w-4 h-4" />
                        停止
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRunScript(script.id, script.name)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors shrink-0"
                      >
                        <Play className="w-4 h-4" />
                        実行
                      </button>
                    )}
                  </div>

                  {/* 実行中の場合、ログを表示するボタン */}
                  {runId && (
                    <button
                      onClick={() => setSelectedRunId(runId)}
                      className={`mt-2 w-full px-3 py-1.5 text-sm rounded transition-colors ${
                        selectedRunId === runId
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      ログを表示
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ログビューアー */}
      <div className="flex-1">
        {selectedRunId ? (
          <ScriptLogViewer runId={selectedRunId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>スクリプトを実行するか、ログを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
