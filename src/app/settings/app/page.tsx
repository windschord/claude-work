'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BackButton } from '@/components/settings/BackButton';
import { UnsavedChangesDialog } from '@/components/settings/UnsavedChangesDialog';

interface EnvVarEntry {
  id: string;
  key: string;
  value: string;
}

const ENV_VAR_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ClaudeDefaults {
  dangerouslySkipPermissions: boolean;
  worktree: boolean;
}

interface AppConfig {
  git_clone_timeout_minutes: number;
  debug_mode_keep_volumes: boolean;
  claude_defaults: ClaudeDefaults;
  custom_env_vars: Record<string, string>;
}

/**
 * アプリケーション設定ページ
 *
 * アプリケーションの設定を管理します。
 * - git cloneのタイムアウト設定
 * - デバッグモードでのDockerボリューム保持設定
 */
export default function AppSettingsPage() {
  const router = useRouter();
  const [_config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [keepVolumes, setKeepVolumes] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [worktreeEnabled, setWorktreeEnabled] = useState(true);
  const [envEntries, setEnvEntries] = useState<EnvVarEntry[]>([]);

  // 未保存変更の管理
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
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
        setSkipPermissions(config.claude_defaults?.dangerouslySkipPermissions ?? false);
        setWorktreeEnabled(config.claude_defaults?.worktree ?? true);
        const envVars: Record<string, string> = config.custom_env_vars ?? {};
        setEnvEntries(
          Object.entries(envVars).map(([key, value]) => ({
            id: generateId(),
            key,
            value,
          }))
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '設定の取得に失敗しました';
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchConfig();
  }, []);

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

    // 環境変数キーのバリデーション
    const nonEmptyEntries = envEntries.filter((e) => e.key.trim());
    for (const entry of nonEmptyEntries) {
      if (!ENV_VAR_KEY_PATTERN.test(entry.key.trim())) {
        toast.error(`環境変数キー "${entry.key}" が不正です。大文字英字・数字・アンダースコアのみ使用できます。`);
        return;
      }
    }

    // 重複キーチェック
    const keys = nonEmptyEntries.map((e) => e.key.trim());
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      toast.error(`環境変数キー "${duplicates[0]}" が重複しています。`);
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
          claude_defaults: {
            dangerouslySkipPermissions: skipPermissions,
            worktree: worktreeEnabled,
          },
          custom_env_vars: Object.fromEntries(
            envEntries
              .filter((e) => e.key.trim())
              .map((e) => [e.key.trim(), e.value])
          ),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '設定の保存に失敗しました');
      }

      const data = await response.json();
      const config = data.config;
      setConfig(config);
      // サーバーから返却された値で状態を同期
      setTimeoutMinutes(config?.git_clone_timeout_minutes ?? timeoutMinutes);
      setKeepVolumes(config?.debug_mode_keep_volumes ?? keepVolumes);
      setSkipPermissions(config?.claude_defaults?.dangerouslySkipPermissions ?? skipPermissions);
      setWorktreeEnabled(config?.claude_defaults?.worktree ?? worktreeEnabled);
      const savedEnvVars: Record<string, string> = config?.custom_env_vars ?? {};
      setEnvEntries(
        Object.entries(savedEnvVars).map(([key, value]) => ({
          id: generateId(),
          key,
          value,
        }))
      );
      setHasUnsavedChanges(false); // 保存後にフラグをリセット
      toast.success('設定を保存しました');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '設定の保存に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // タイムアウト値変更時の処理
  const handleTimeoutChange = (value: number) => {
    setTimeoutMinutes(value);
    setHasUnsavedChanges(true);
  };

  // デバッグモード変更時の処理
  const handleKeepVolumesChange = (checked: boolean) => {
    setKeepVolumes(checked);
    setHasUnsavedChanges(true);
  };

  // パーミッション自動スキップ変更時の処理
  const handleSkipPermissionsChange = (checked: boolean) => {
    setSkipPermissions(checked);
    setHasUnsavedChanges(true);
  };

  // Worktreeモード変更時の処理
  const handleWorktreeChange = (checked: boolean) => {
    setWorktreeEnabled(checked);
    setHasUnsavedChanges(true);
  };

  // 環境変数エントリの追加
  const handleAddEnvEntry = () => {
    setEnvEntries((prev) => [...prev, { id: generateId(), key: '', value: '' }]);
    setHasUnsavedChanges(true);
  };

  // 環境変数エントリの削除
  const handleRemoveEnvEntry = (id: string) => {
    setEnvEntries((prev) => prev.filter((e) => e.id !== id));
    setHasUnsavedChanges(true);
  };

  // 環境変数エントリの更新
  const handleEnvEntryChange = (id: string, field: 'key' | 'value', newValue: string) => {
    setEnvEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: newValue } : e))
    );
    setHasUnsavedChanges(true);
  };

  // 戻るボタンの前処理
  const handleBeforeNavigate = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return false; // ナビゲーション中断
    }
    return true; // ナビゲーション許可
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
      {/* 戻るボタン */}
      <div className="mb-4">
        <BackButton onBeforeNavigate={handleBeforeNavigate} />
      </div>

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
              onChange={(e) => {
                const value = e.currentTarget.valueAsNumber;
                if (!Number.isNaN(value)) {
                  handleTimeoutChange(value);
                }
              }}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isSaving || isLoading || _config === null}
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
                onChange={(e) => handleKeepVolumesChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                disabled={isSaving || isLoading || _config === null}
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

        {/* Claude Code デフォルト設定 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Claude Code デフォルト設定
          </h2>

          {/* パーミッション自動スキップ */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="skip-permissions"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  パーミッション自動スキップ
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Docker環境でのみ有効
                </p>
              </div>
              <button
                id="skip-permissions"
                type="button"
                role="switch"
                aria-checked={skipPermissions}
                onClick={() => handleSkipPermissionsChange(!skipPermissions)}
                disabled={isSaving || isLoading || _config === null}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  skipPermissions
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    skipPermissions ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Docker環境でClaude Code起動時に --dangerously-skip-permissions を付与します。
              <br />
              HOST環境では常に無効です。
            </p>
          </div>

          {/* Worktreeモード */}
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="worktree-mode"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Worktreeモード
                </label>
              </div>
              <button
                id="worktree-mode"
                type="button"
                role="switch"
                aria-checked={worktreeEnabled}
                onClick={() => handleWorktreeChange(!worktreeEnabled)}
                disabled={isSaving || isLoading || _config === null}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  worktreeEnabled
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    worktreeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              各セッションがClaude Codeの --worktree オプションで分離されます。
            </p>
          </div>
        </div>

        {/* アプリケーション共通環境変数 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            アプリケーション共通環境変数
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            全プロジェクト・セッションに共通で適用される環境変数を設定します。
            プロジェクト・セッション単位で同じキーを設定すると上書きされます。
          </p>
          <div className="space-y-2">
            {envEntries.map((entry) => {
              const normalizedKey = entry.key.trim();
              const hasKey = normalizedKey.length > 0;
              const isInvalidKey = hasKey && !ENV_VAR_KEY_PATTERN.test(normalizedKey);
              const keyLabel = normalizedKey || '未設定';

              return (
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="KEY"
                    aria-label={`環境変数キー ${keyLabel}`}
                    value={entry.key}
                    onChange={(e) => handleEnvEntryChange(entry.id, 'key', e.target.value)}
                    className={`w-1/3 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono text-sm ${
                      isInvalidKey
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    disabled={isSaving || isLoading || _config === null}
                  />
                  <span className="text-gray-400">=</span>
                  <input
                    type="text"
                    placeholder="value"
                    aria-label={`環境変数値 ${keyLabel}`}
                    value={entry.value}
                    onChange={(e) => handleEnvEntryChange(entry.id, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono text-sm"
                    disabled={isSaving || isLoading || _config === null}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEnvEntry(entry.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    disabled={isSaving || isLoading || _config === null}
                    aria-label={`環境変数 ${keyLabel} を削除`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAddEnvEntry}
            className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            disabled={isSaving || isLoading || _config === null}
          >
            <Plus className="w-4 h-4" />
            環境変数を追加
          </button>
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

      {/* 未保存変更警告ダイアログ */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onDiscard={() => {
          setShowUnsavedDialog(false);
          router.push('/settings');
        }}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </div>
  );
}
