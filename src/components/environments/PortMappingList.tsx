'use client';

import { useState } from 'react';
import { Plus, X, CheckCircle2, AlertCircle, HelpCircle, Loader2, Search } from 'lucide-react';
import type { PortMapping } from '@/types/environment';
import { validatePortMappings } from '@/lib/docker-config-validator';

interface PortCheckResult {
  status: string;
  usedBy?: string;
  source?: string;
}

interface PortMappingListProps {
  value: PortMapping[];
  onChange: (mappings: PortMapping[]) => void;
  excludeEnvironmentId?: string;
}

/**
 * ポートマッピングの動的リスト入力コンポーネント
 *
 * Docker環境設定でホストポートとコンテナポートのマッピングを
 * 追加・編集・削除できるリストUIを提供する。
 * validatePortMappings()によるリアルタイムバリデーションを行う。
 * ポートチェック機能でホストポートの使用状況を確認できる。
 */
export function PortMappingList({ value, onChange, excludeEnvironmentId }: PortMappingListProps) {
  const [keyState, setKeyState] = useState(() => ({
    counter: value.length,
    keys: value.map((_, i) => i),
  }));
  const [portCheckResults, setPortCheckResults] = useState<Map<number, PortCheckResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);

  // 親コンポーネントによるvalue外部変更時にkeysを同期する
  if (keyState.keys.length !== value.length) {
    if (value.length > keyState.keys.length) {
      const newKeys = [...keyState.keys];
      let counter = keyState.counter;
      while (newKeys.length < value.length) {
        newKeys.push(counter++);
      }
      setKeyState({ counter, keys: newKeys });
    } else {
      setKeyState(prev => ({ ...prev, keys: prev.keys.slice(0, value.length) }));
    }
  }

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

      if (field === 'hostPort') {
        const oldPort = mapping.hostPort;
        setPortCheckResults(prev => {
          const next = new Map(prev);
          next.delete(oldPort);
          return next;
        });
      }

      return { ...mapping, [field]: numValue };
    });

    onChange(updated);
  };

  const handleCheckPorts = async () => {
    const validPorts = value
      .map(m => m.hostPort)
      .filter(p => Number.isInteger(p) && p >= 1 && p <= 65535);

    if (validPorts.length === 0) return;

    setIsChecking(true);
    try {
      const response = await fetch('/api/environments/check-ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ports: validPorts,
          excludeEnvironmentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newResults = new Map<number, PortCheckResult>();
        for (const result of data.results) {
          newResults.set(result.port, result);
        }
        setPortCheckResults(newResults);
      } else {
        const unknownResults = new Map<number, PortCheckResult>();
        for (const port of validPorts) {
          unknownResults.set(port, { status: 'unknown' });
        }
        setPortCheckResults(unknownResults);
      }
    } catch {
      const unknownResults = new Map<number, PortCheckResult>();
      for (const port of validPorts) {
        unknownResults.set(port, { status: 'unknown' });
      }
      setPortCheckResults(unknownResults);
    } finally {
      setIsChecking(false);
    }
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
          {value.map((mapping, index) => {
            const checkResult = portCheckResults.get(mapping.hostPort);
            return (
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
                {checkResult && (
                  <span className="flex items-center gap-1 text-xs">
                    {checkResult.status === 'available' && (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">利用可能</span>
                      </>
                    )}
                    {checkResult.status === 'in_use' && (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">
                          使用中{checkResult.usedBy ? `: ${checkResult.usedBy}` : ''}
                        </span>
                      </>
                    )}
                    {checkResult.status === 'unknown' && (
                      <>
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">チェック不可</span>
                      </>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="削除"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <Plus className="h-4 w-4" />
          ポートを追加
        </button>
        {value.length > 0 && value.some(m => m.hostPort >= 1 && m.hostPort <= 65535) && (
          <button
            type="button"
            onClick={handleCheckPorts}
            disabled={isChecking}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            ポートチェック
          </button>
        )}
      </div>
    </div>
  );
}
