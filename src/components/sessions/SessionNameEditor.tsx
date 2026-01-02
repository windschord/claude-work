'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Pencil, Loader2 } from 'lucide-react';

interface SessionNameEditorProps {
  /** セッションID */
  sessionId: string;
  /** 初期セッション名 */
  initialName: string;
  /** 保存成功時のコールバック */
  onSave?: (newName: string) => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
}

/**
 * SessionNameEditorコンポーネント
 *
 * クリックで編集可能なセッション名表示。
 * - クリックで編集モードに切り替え
 * - Enterキーまたはblurで保存
 * - Escapeキーでキャンセル
 * - 変更がない場合はAPIを呼ばない
 *
 * @param props - コンポーネントのプロパティ
 * @returns セッション名エディタのJSX要素
 */
export function SessionNameEditor({
  sessionId,
  initialName,
  onSave,
  onError,
}: SessionNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集モードに入った時にフォーカス
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();

    // 空の名前は保存しない
    if (!trimmedName) {
      setIsEditing(false);
      setName(initialName);
      return;
    }

    // 変更がない場合はAPIを呼ばない
    if (trimmedName === initialName) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to update session name';
        onError?.(errorMessage);
        setName(initialName);
        setIsEditing(false);
        return;
      }

      onSave?.(trimmedName);
      setIsEditing(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
      setName(initialName);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  }, [name, initialName, sessionId, onSave, onError]);

  const handleCancel = useCallback(() => {
    setName(initialName);
    setIsEditing(false);
  }, [initialName]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleBlur = useCallback(() => {
    // ローディング中はblurを無視
    if (!isLoading) {
      handleSave();
    }
  }, [handleSave, isLoading]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isLoading}
          className="
            px-2 py-1 rounded-md border
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            disabled:bg-gray-100 dark:disabled:bg-gray-900
            disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-blue-500
            text-lg font-semibold
          "
        />
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="
        group flex items-center gap-2
        text-lg font-semibold
        text-gray-900 dark:text-gray-100
        hover:text-blue-600 dark:hover:text-blue-400
        transition-colors duration-150
      "
    >
      <span>{name}</span>
      <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
    </button>
  );
}
