'use client';

import { useCallback } from 'react';

/**
 * モデルオプションの定義
 */
const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'claude-opus-4', label: 'Opus' },
  { value: 'claude-sonnet-4', label: 'Sonnet' },
  { value: 'claude-haiku', label: 'Haiku' },
] as const;

interface ModelSelectorProps {
  /** 現在選択されているモデル値 */
  value: string;
  /** 選択変更時のコールバック */
  onChange: (value: string) => void;
  /** コンパクトモード（select表示）かフルモード（ボタン群表示）か */
  compact?: boolean;
  /** 無効化状態 */
  disabled?: boolean;
  /** ラベル */
  label?: string;
}

/**
 * ModelSelectorコンポーネント
 *
 * モデル選択UI。2つの表示モードを持つ:
 * - フルモード（デフォルト）: ボタン群で表示
 * - コンパクトモード: セレクトボックスで表示
 *
 * @param props - コンポーネントのプロパティ
 * @returns モデル選択UIのJSX要素
 */
export function ModelSelector({
  value,
  onChange,
  compact = false,
  disabled = false,
  label,
}: ModelSelectorProps) {
  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {compact ? (
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="
            px-3 py-2 rounded-md border
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            disabled:bg-gray-100 dark:disabled:bg-gray-900
            disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-1">
          {MODEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange(option.value)}
              disabled={disabled}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium
                transition-colors duration-150
                disabled:cursor-not-allowed disabled:opacity-50
                ${
                  value === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
