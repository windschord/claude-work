'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AppConfig {
  git_clone_timeout_minutes: number;
  debug_mode_keep_volumes: boolean;
}

/**
 * アプリケーション設定ページ
 *
 * アプリケーションの設定を管理します。
 * - git cloneのタイムアウト設定
 * - デバッグモードでのDockerボリューム保持設定
 */
export default function AppSettingsPage() {
  const [_config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [keepVolumes, setKeepVolumes] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/config');

      if (!response.ok) {
        throw new Error('設定の取得に失敗しました');
      }

      const data = await response.json();
      const config = data.config;
      if (!config) {
        throw new Error('設定の取得に失敗しました');
      }
      setConfig(config);
      setTimeoutMinutes(config.git_clone_timeout_minutes ?? 5);
      setKeepVolumes(config.debug_mode_keep_volumes ?? false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '設定の取得に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 設定読み込み中のガード
    if (isLoading || _config === null) {
      toast.error('設定の読み込みが完了していません');
      return;
    }

    // タイムアウト値のバリデーション
    if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 30) {
      toast.error('タイムアウト時間は1から30の整数で指定してください');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          git_clone_timeout_minutes: timeoutMinutes,
          debug_mode_keep_volumes: keepVolumes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '設定の保存に失敗しました');
      }

      const data = await response.json();
      setConfig(data.config);
      toast.success('設定を保存しました');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '設定の保存に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">アプリケーション設定</h1>

      <form onSubmit={handleSave} className="max-w-2xl">
        {/* Git Clone タイムアウト設定 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Git Clone タイムアウト
          </h2>
          <div className="mb-4">
            <label
              htmlFor="timeout"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              タイムアウト時間（分）
            </label>
            <input
              id="timeout"
              type="number"
              min="1"
              max="30"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isSaving}
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              リモートリポジトリのclone時のタイムアウト時間を設定します（1-30分）。
            </p>
          </div>
        </div>

        {/* デバッグモード設定 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            デバッグモード
          </h2>
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={keepVolumes}
                onChange={(e) => setKeepVolumes(e.target.checked)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                disabled={isSaving}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Dockerボリュームを保持する
              </span>
            </label>
            <p className="mt-2 ml-6 text-sm text-gray-500 dark:text-gray-400">
              エラー時やプロジェクト削除時にDockerボリュームを自動削除せず保持します。
              <br />
              デバッグやトラブルシューティング時に有効にしてください。
            </p>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSaving || isLoading || _config === null}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
