'use client';

import { useEffect, useState } from 'react';
import { useRunScriptsStore } from '@/store/runScripts';
import { RunScript } from '@/lib/api';

interface RunScriptSettingsProps {
  projectId: string;
}

export function RunScriptSettings({ projectId }: RunScriptSettingsProps) {
  const { runScripts, loading, error, fetchRunScripts, createRunScript, updateRunScript, deleteRunScript, clearError } =
    useRunScriptsStore();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', command: '' });

  const scripts = runScripts[projectId] || [];

  useEffect(() => {
    fetchRunScripts(projectId);
  }, [projectId, fetchRunScripts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId !== null) {
        await updateRunScript(projectId, editingId, formData.name, formData.command);
        setEditingId(null);
      } else {
        await createRunScript(projectId, formData.name, formData.command);
        setIsAddingNew(false);
      }
      setFormData({ name: '', command: '' });
    } catch (error) {
      // エラーはストアで管理されている
    }
  };

  const handleEdit = (script: RunScript) => {
    setEditingId(script.id);
    setFormData({ name: script.name, command: script.command });
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({ name: '', command: '' });
    clearError();
  };

  const handleDelete = async (scriptId: number) => {
    if (confirm('このランスクリプトを削除してもよろしいですか?')) {
      try {
        await deleteRunScript(projectId, scriptId);
      } catch (error) {
        // エラーはストアで管理されている
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">ランスクリプト設定</h2>
        {!isAddingNew && editingId === null && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            追加
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button onClick={clearError} className="ml-4 underline">
            閉じる
          </button>
        </div>
      )}

      {(isAddingNew || editingId !== null) && (
        <form onSubmit={handleSubmit} className="p-4 border border-gray-300 rounded space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="例: Build"
            />
          </div>
          <div>
            <label htmlFor="command" className="block text-sm font-medium text-gray-700 mb-1">
              コマンド
            </label>
            <input
              type="text"
              id="command"
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              required
              placeholder="例: npm run build"
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? '保存中...' : editingId !== null ? '更新' : '追加'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {loading && scripts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ランスクリプトがありません</div>
      ) : (
        <div className="space-y-2">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="p-4 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{script.name}</h3>
                  <p className="text-sm text-gray-600 font-mono mt-1">{script.command}</p>
                </div>
                {editingId !== script.id && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(script)}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(script.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
