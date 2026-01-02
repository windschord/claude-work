'use client';

import { useEffect, useState } from 'react';
import { api, ScriptExecutionResult } from '@/lib/api';
import { useRunScriptsStore } from '@/store/runScripts';
import LogViewer from './LogViewer';

interface RunScriptPanelProps {
  sessionId: string;
  projectId: string;
}

export default function RunScriptPanel({ sessionId, projectId }: RunScriptPanelProps) {
  const { runScripts, fetchRunScripts, error: storeError } = useRunScriptsStore();
  const scripts = runScripts[projectId] || [];

  const [selectedScript, setSelectedScript] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ScriptExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchRunScripts(projectId);
    }
  }, [projectId, fetchRunScripts]);

  const handleExecute = async (scriptId: number) => {
    setSelectedScript(scriptId);
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const executionResult = await api.executeRunScript(sessionId, scriptId);
      setResult(executionResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'スクリプトの実行に失敗しました';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  if (storeError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{storeError}</p>
        </div>
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <p className="text-gray-600">このプロジェクトにはランスクリプトが登録されていません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* スクリプト一覧 */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ランスクリプト</h3>
        <div className="space-y-2">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{script.name}</p>
                <p className="text-sm text-gray-500 font-mono">{script.command}</p>
              </div>
              <button
                onClick={() => handleExecute(script.id)}
                disabled={isExecuting}
                className={`ml-4 px-4 py-2 rounded-md font-medium ${
                  isExecuting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isExecuting && selectedScript === script.id ? '実行中...' : '実行'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 出力表示エリア */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* ステータス情報 */}
            <div className="flex items-center gap-4">
              <div
                className={`px-3 py-1 rounded-md font-medium ${
                  result.success
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {result.success ? '成功' : '失敗'}
              </div>
              <div className="text-sm text-gray-600">
                終了コード: <span className="font-mono">{result.exit_code}</span>
              </div>
              <div className="text-sm text-gray-600">
                実行時間: <span className="font-mono">{result.execution_time.toFixed(2)}秒</span>
              </div>
            </div>

            {/* 出力 */}
            <div className="bg-gray-900 rounded-md overflow-hidden" style={{ height: '500px' }}>
              <LogViewer output={result.output || ''} />
            </div>
          </div>
        )}

        {!result && !error && !isExecuting && (
          <div className="text-center text-gray-500 py-8">
            スクリプトを選択して実行してください
          </div>
        )}

        {isExecuting && (
          <div className="text-center text-gray-500 py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2">実行中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
