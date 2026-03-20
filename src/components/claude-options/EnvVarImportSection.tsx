'use client';

import { useState } from 'react';
import { FileUp, AlertTriangle, Loader2 } from 'lucide-react';
import type { CustomEnvVars } from '@/services/claude-options-service';

interface EnvVarImportSectionProps {
  projectId: string;
  existingVars: CustomEnvVars;
  onImport: (vars: CustomEnvVars) => void;
  disabled?: boolean;
}

type ImportState = 'idle' | 'loading-files' | 'select-file' | 'loading-parse' | 'preview' | 'no-files';

interface ParseResult {
  variables: { [key: string]: string };
  errors: string[];
}

export function EnvVarImportSection({
  projectId,
  existingVars,
  onImport,
  disabled = false,
}: EnvVarImportSectionProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [envFiles, setEnvFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');

  const handleStartImport = async () => {
    setState('loading-files');
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/env-files`);
      if (!response.ok) {
        throw new Error('ファイル一覧の取得に失敗しました');
      }
      const data = await response.json();
      const files: string[] = data.files || [];

      if (files.length === 0) {
        setState('no-files');
      } else {
        setEnvFiles(files);
        setSelectedFile('');
        setParseResult(null);
        setState('select-file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setState('idle');
    }
  };

  const handleFileSelect = async (filename: string) => {
    if (!filename) {
      setSelectedFile('');
      setParseResult(null);
      setState('select-file');
      return;
    }

    setSelectedFile(filename);
    setState('loading-parse');
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/env-files/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!response.ok) {
        throw new Error('ファイルのパースに失敗しました');
      }
      const data: ParseResult = await response.json();
      setParseResult(data);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setState('select-file');
    }
  };

  const handleImport = () => {
    if (!parseResult) return;
    onImport(parseResult.variables);
    handleCancel();
  };

  const handleCancel = () => {
    setState('idle');
    setEnvFiles([]);
    setSelectedFile('');
    setParseResult(null);
    setError('');
  };

  const truncateValue = (value: string, maxLength = 20) => {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength) + '...';
  };

  const getDuplicateKeys = (): string[] => {
    if (!parseResult) return [];
    return Object.keys(parseResult.variables).filter(
      (key) => key in existingVars
    );
  };

  if (state === 'idle') {
    return (
      <div className="mb-2">
        <button
          type="button"
          onClick={handleStartImport}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          disabled={disabled}
        >
          <FileUp className="w-3 h-3" />
          .envからインポート
        </button>
      </div>
    );
  }

  if (state === 'loading-files') {
    return (
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        ファイル一覧を取得中...
      </div>
    );
  }

  if (state === 'no-files') {
    return (
      <div className="mb-2 space-y-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          .envファイルが見つかりません
        </p>
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 space-y-3">
      {/* File selector */}
      <div className="flex items-center gap-2">
        <select
          value={selectedFile}
          onChange={(e) => handleFileSelect(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          disabled={disabled || state === 'loading-parse'}
        >
          <option value="">ファイルを選択...</option>
          {envFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
        >
          キャンセル
        </button>
      </div>

      {/* Loading parse */}
      {state === 'loading-parse' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          パース中...
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Preview */}
      {state === 'preview' && parseResult && (
        <div className="space-y-2">
          {/* Parse errors */}
          {parseResult.errors.length > 0 && (
            <div className="space-y-1">
              {parseResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Variable count */}
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {Object.keys(parseResult.variables).length}件の変数
          </p>

          {/* Duplicate warning */}
          {getDuplicateKeys().length > 0 && (
            <div className="flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                以下のキーは既存の環境変数を上書きします: {getDuplicateKeys().join(', ')}
              </span>
            </div>
          )}

          {/* Variable list */}
          {Object.keys(parseResult.variables).length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {Object.entries(parseResult.variables).map(([key, value]) => (
                <div
                  key={key}
                  className={`text-xs font-mono px-2 py-1 rounded ${
                    key in existingVars
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {key}={truncateValue(value)}
                </div>
              ))}
            </div>
          )}

          {/* Import button */}
          {Object.keys(parseResult.variables).length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={disabled}
            >
              インポート
            </button>
          )}
        </div>
      )}
    </div>
  );
}
