'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/store/settings';

interface Session {
  id: string;
  name: string;
  status: string;
}

interface QuickCreateButtonProps {
  /** プロジェクトID */
  projectId: string;
  /** 作成成功時のコールバック */
  onSuccess?: (session: Session) => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
  /** ボタンのラベル（デフォルト: +アイコン） */
  label?: string;
}

/**
 * QuickCreateButtonコンポーネント
 *
 * ワンクリックでセッションを作成するボタン。
 * - セッション名は自動生成
 * - モデルはuseSettingsStoreのdefaultModelを使用
 * - プロンプトなしで作成
 *
 * @param props - コンポーネントのプロパティ
 * @returns クイック作成ボタンのJSX要素
 */
export function QuickCreateButton({
  projectId,
  onSuccess,
  onError,
  label,
}: QuickCreateButtonProps) {
  const router = useRouter();
  const { defaultModel } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    // 重複リクエスト防止
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: defaultModel,
          prompt: '', // プロンプトなし（Task 43.15でオプショナル化が必要）
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to create session';
        onError?.(errorMessage);
        return;
      }

      onSuccess?.(data.session);
      router.push(`/sessions/${data.session.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, projectId, defaultModel, onSuccess, onError, router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="
        inline-flex items-center justify-center gap-1
        px-3 py-1.5 rounded-md
        bg-blue-500 hover:bg-blue-600
        disabled:bg-blue-300 disabled:cursor-not-allowed
        text-white text-sm font-medium
        transition-colors duration-150
      "
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {label && <span>{label}</span>}
    </button>
  );
}
