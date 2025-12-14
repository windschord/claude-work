'use client';

import { useEffect, useState } from 'react';
import { useRunScriptStore } from '@/store/run-scripts';
import { AddRunScriptModal } from './AddRunScriptModal';
import { EditRunScriptModal } from './EditRunScriptModal';
import { DeleteRunScriptDialog } from './DeleteRunScriptDialog';
import type { RunScript } from '@/store/run-scripts';

interface RunScriptListProps {
  projectId: string;
}

/**
 * ランスクリプト一覧コンポーネント
 *
 * プロジェクトのランスクリプト一覧を表示し、追加・編集・削除の操作を提供します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.projectId - プロジェクトID
 * @returns ランスクリプト一覧のJSX要素
 */
export function RunScriptList({ projectId }: RunScriptListProps) {
  const { scripts, isLoading, fetchScripts, deleteScript } = useRunScriptStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<RunScript | null>(null);
  const [deletingScript, setDeletingScript] = useState<RunScript | null>(null);

  useEffect(() => {
    fetchScripts(projectId);
  }, [projectId, fetchScripts]);

  const handleDelete = async () => {
    if (deletingScript) {
      await deleteScript(projectId, deletingScript.id);
      setDeletingScript(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">ランスクリプト</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          スクリプト追加
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-8 border border-gray-200 rounded-lg">
          <p className="text-gray-500">スクリプトが登録されていません</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  説明
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  コマンド
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scripts.map((script) => (
                <tr key={script.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-gray-900">{script.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {script.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                      {script.command}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingScript(script)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                      aria-label="編集"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => setDeletingScript(script)}
                      className="text-red-600 hover:text-red-900"
                      aria-label="削除"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddRunScriptModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        projectId={projectId}
      />

      {editingScript && (
        <EditRunScriptModal
          isOpen={true}
          onClose={() => setEditingScript(null)}
          projectId={projectId}
          script={editingScript}
        />
      )}

      {deletingScript && (
        <DeleteRunScriptDialog
          isOpen={true}
          onClose={() => setDeletingScript(null)}
          onConfirm={handleDelete}
          scriptName={deletingScript.name}
        />
      )}
    </div>
  );
}
