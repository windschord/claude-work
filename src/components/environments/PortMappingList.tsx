'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { PortMapping } from '@/types/environment';
import { validatePortMappings } from '@/lib/docker-config-validator';

interface PortMappingListProps {
  value: PortMapping[];
  onChange: (mappings: PortMapping[]) => void;
}

/**
 * ポートマッピングの動的リスト入力コンポーネント
 *
 * Docker環境設定でホストポートとコンテナポートのマッピングを
 * 追加・編集・削除できるリストUIを提供する。
 * validatePortMappings()によるリアルタイムバリデーションを行う。
 */
export function PortMappingList({ value, onChange }: PortMappingListProps) {
  const [keyState, setKeyState] = useState(() => ({
    counter: value.length,
    keys: value.map((_, i) => i),
  }));

  const validation = value.length > 0 ? validatePortMappings(value) : null;

  const handleAdd = () => {
    setKeyState(prev => ({
      counter: prev.counter + 1,
      keys: [...prev.keys, prev.counter],
    }));
    onChange([...value, { hostPort: 0, containerPort: 0, protocol: 'tcp' }]);
  };

  const handleRemove = (index: number) => {
    setKeyState(prev => ({
      ...prev,
      keys: prev.keys.filter((_, i) => i !== index),
    }));
    onChange(value.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof PortMapping, rawValue: string | number) => {
    const updated = value.map((mapping, i) => {
      if (i !== index) return mapping;

      if (field === 'protocol') {
        return { ...mapping, protocol: rawValue as 'tcp' | 'udp' };
      }

      const numValue = typeof rawValue === 'string' ? parseInt(rawValue, 10) || 0 : rawValue;
      return { ...mapping, [field]: numValue };
    });

    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
        ポートマッピング
      </h4>

      {value.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ポートマッピングは設定されていません
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((mapping, index) => (
            <div key={keyState.keys[index]} className="flex items-center gap-2">
              <input
                type="number"
                value={mapping.hostPort || ''}
                onChange={(e) => handleChange(index, 'hostPort', e.target.value)}
                placeholder="ホストポート"
                className="w-28 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={65535}
              />
              <span className="text-gray-500 dark:text-gray-400">:</span>
              <input
                type="number"
                value={mapping.containerPort || ''}
                onChange={(e) => handleChange(index, 'containerPort', e.target.value)}
                placeholder="コンテナポート"
                className="w-28 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={65535}
              />
              <select
                value={mapping.protocol ?? 'tcp'}
                onChange={(e) => handleChange(index, 'protocol', e.target.value)}
                className="px-2 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="削除"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {validation && !validation.valid && (
        <div className="space-y-1">
          {validation.errors.map((error, index) => (
            <p key={index} className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        <Plus className="h-4 w-4" />
        ポートを追加
      </button>
    </div>
  );
}
