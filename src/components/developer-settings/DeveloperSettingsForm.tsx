'use client';

import { useState, useEffect } from 'react';

interface DeveloperSettingsFormProps {
  gitUsername: string | null;
  gitEmail: string | null;
  loading: boolean;
  effectiveSettings?: {
    git_username: string | null;
    git_email: string | null;
    source: {
      git_username: 'global' | 'project';
      git_email: 'global' | 'project';
    };
  } | null;
  onSave: (data: { git_username?: string; git_email?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  showDeleteButton?: boolean;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function DeveloperSettingsForm({
  gitUsername,
  gitEmail,
  loading,
  effectiveSettings,
  onSave,
  onDelete,
  showDeleteButton = false,
}: DeveloperSettingsFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUsername(gitUsername || '');
    setEmail(gitEmail || '');
  }, [gitUsername, gitEmail]);

  const validate = (): boolean => {
    const newErrors: { username?: string; email?: string } = {};

    if (username && username.length > 100) {
      newErrors.username = 'Git Username は100文字以内で入力してください';
    }

    if (email && !isValidEmail(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!username && !email) {
      newErrors.username = 'Username または Email のいずれかを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const data: { git_username?: string; git_email?: string } = {};
      if (username) data.git_username = username;
      if (email) data.git_email = email;
      await onSave(data);
    } catch {
      // エラーはStoreで処理される
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('プロジェクト設定を削除してグローバル設定に戻しますか?')) return;

    setDeleting(true);
    try {
      await onDelete();
    } catch {
      // エラーはStoreで処理される
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Git 設定
      </h3>

      {effectiveSettings &&
       (effectiveSettings.source?.git_username === 'global' || effectiveSettings.source?.git_email === 'global') && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            グローバル設定が適用されています。プロジェクト固有の設定を追加するには、以下のフォームに入力してください。
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="git-username"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Git Username
          </label>
          <input
            id="git-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            placeholder={effectiveSettings?.git_username || '例: john.doe'}
            className={`w-full px-3 py-2 border rounded-md text-sm
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${errors.username ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
            maxLength={100}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" aria-live="polite">
              {errors.username}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="git-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Git Email
          </label>
          <input
            id="git-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder={effectiveSettings?.git_email || '例: john@example.com'}
            className={`w-full px-3 py-2 border rounded-md text-sm
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${errors.email ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" aria-live="polite">
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>

          {showDeleteButton && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md
                hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? '削除中...' : 'プロジェクト設定を削除'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
