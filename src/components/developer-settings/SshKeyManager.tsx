'use client';

import { useState, useEffect } from 'react';
import { Trash2, Eye, Upload } from 'lucide-react';
import { useDeveloperSettingsStore, SshKey, RegisterSshKeyInput } from '@/store/developer-settings';

function SshKeyUploadForm({ onRegister, loading }: {
  onRegister: (data: RegisterSshKeyInput) => Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [errors, setErrors] = useState<{ name?: string; privateKey?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: { name?: string; privateKey?: string } = {};

    if (!name.trim()) {
      newErrors.name = '鍵の名前を入力してください';
    } else if (name.length > 100) {
      newErrors.name = '名前は100文字以内で入力してください';
    }

    if (!privateKey.trim()) {
      newErrors.privateKey = '秘密鍵を選択してください';
    } else if (!privateKey.includes('BEGIN') || !privateKey.includes('KEY')) {
      newErrors.privateKey = '有効な SSH 鍵ファイルを選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileRead = (
    file: File,
    setter: (value: string) => void,
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setter(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: RegisterSshKeyInput = {
        name: name.trim(),
        private_key: privateKey,
      };
      if (publicKey.trim()) {
        data.public_key = publicKey;
      }
      await onRegister(data);
      setName('');
      setPrivateKey('');
      setPublicKey('');
      setErrors({});
    } catch {
      // エラーはStoreで処理される
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="ssh-key-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          鍵の名前
        </label>
        <input
          id="ssh-key-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder="例: GitHub Personal"
          className={`w-full px-3 py-2 border rounded-md text-sm
            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          maxLength={100}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400" aria-live="polite">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="ssh-private-key"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          秘密鍵
        </label>
        <div className="flex items-center gap-2">
          <label
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer
              bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors
              ${errors.privateKey ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
          >
            <Upload className="w-4 h-4" />
            ファイル選択
            <input
              id="ssh-private-key"
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileRead(file, setPrivateKey);
                  if (errors.privateKey) setErrors((prev) => ({ ...prev, privateKey: undefined }));
                }
              }}
            />
          </label>
          {privateKey && (
            <span className="text-sm text-green-600 dark:text-green-400">
              選択済み
            </span>
          )}
        </div>
        {errors.privateKey && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400" aria-live="polite">
            {errors.privateKey}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="ssh-public-key"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          公開鍵 <span className="text-gray-400">(オプション)</span>
        </label>
        <div className="flex items-center gap-2">
          <label
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600
              rounded-md text-sm cursor-pointer bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            ファイル選択
            <input
              id="ssh-public-key"
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileRead(file, setPublicKey);
              }}
            />
          </label>
          {publicKey && (
            <span className="text-sm text-green-600 dark:text-green-400">
              選択済み
            </span>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || loading}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? '追加中...' : '追加'}
      </button>
    </form>
  );
}

function SshKeyList({ keys, onDelete, loading }: {
  keys: SshKey[];
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}) {
  const [viewingKey, setViewingKey] = useState<SshKey | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか? この操作は取り消せません。')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch {
      // エラーはStoreで処理される
    } finally {
      setDeletingId(null);
    }
  };

  const truncateKey = (key: string | null): string => {
    if (!key) return '-';
    return key.length > 30 ? key.substring(0, 30) + '...' : key;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
  };

  if (keys.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        登録済みの SSH 鍵はありません。
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">名前</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">公開鍵</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">登録日</th>
              <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr
                key={key.id}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{key.name}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setViewingKey(key)}
                    className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="公開鍵を表示"
                  >
                    {truncateKey(key.public_key)}
                    {key.public_key && <Eye className="w-3 h-3 flex-shrink-0" />}
                  </button>
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{formatDate(key.created_at)}</td>
                <td className="py-2 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(key.id)}
                    disabled={deletingId === key.id || loading}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                      rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setViewingKey(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              公開鍵: {viewingKey.name}
            </h4>
            <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-xs text-gray-700 dark:text-gray-300
              overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto font-mono">
              {viewingKey.public_key || '(公開鍵なし)'}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingKey(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                  text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SshKeyManager() {
  const { sshKeys, loading, fetchSshKeys, registerSshKey, deleteSshKey } = useDeveloperSettingsStore();

  useEffect(() => {
    fetchSshKeys();
  }, [fetchSshKeys]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        SSH 鍵管理
      </h3>

      <div className="mb-6">
        <SshKeyUploadForm onRegister={registerSshKey} loading={loading} />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          登録済み SSH 鍵
        </h4>
        <SshKeyList keys={sshKeys} onDelete={deleteSshKey} loading={loading} />
      </div>
    </div>
  );
}
