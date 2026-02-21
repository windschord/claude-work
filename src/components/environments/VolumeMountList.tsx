'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { VolumeMount } from '@/types/environment';
import { isDangerousPath, isSystemContainerPath } from '@/lib/docker-config-validator';

interface VolumeMountListProps {
  value: VolumeMount[];
  onChange: (mounts: VolumeMount[]) => void;
  onDangerousPath?: (path: string) => void;
}

interface MountError {
  hostPath?: string;
  containerPath?: string;
}

interface MountWarning {
  hostPath?: string;
}

/**
 * 行ごとのバリデーションエラーを計算する
 */
function validateMount(mount: VolumeMount): { errors: MountError; warnings: MountWarning } {
  const errors: MountError = {};
  const warnings: MountWarning = {};

  // 空のパスはバリデーション対象外（まだ入力されていない）
  if (mount.hostPath && !mount.hostPath.startsWith('/')) {
    errors.hostPath = 'hostPathは絶対パスである必要があります';
  }

  if (mount.containerPath && !mount.containerPath.startsWith('/')) {
    errors.containerPath = 'containerPathは絶対パスである必要があります';
  }

  // システムコンテナパスチェック
  if (mount.containerPath && isSystemContainerPath(mount.containerPath)) {
    errors.containerPath = `containerPath「${mount.containerPath}」はシステムが使用するパスのためマウントできません`;
  }

  // パストラバーサルチェック
  if (mount.hostPath && mount.hostPath.includes('..')) {
    errors.hostPath = 'hostPathに「..」を含めることはできません';
  }
  if (mount.containerPath && mount.containerPath.includes('..')) {
    errors.containerPath = 'containerPathに「..」を含めることはできません';
  }

  // コロン文字チェック
  if (mount.hostPath && !errors.hostPath && mount.hostPath.includes(':')) {
    errors.hostPath = 'hostPathに「:」を含めることはできません';
  }
  if (mount.containerPath && !errors.containerPath && mount.containerPath.includes(':')) {
    errors.containerPath = 'containerPathに「:」を含めることはできません';
  }

  // 危険なホストパスチェック
  if (mount.hostPath && isDangerousPath(mount.hostPath)) {
    warnings.hostPath = `hostPath「${mount.hostPath}」は危険なシステムパスです`;
  }

  return { errors, warnings };
}

/**
 * ボリュームマウントの動的リスト入力コンポーネント
 *
 * Docker環境設定でボリュームマウントを追加・編集・削除するためのUIを提供します。
 * 各マウントにはホストパス、コンテナパス、アクセスモード（RW/RO）を設定できます。
 * リアルタイムでバリデーションを行い、エラーや警告を表示します。
 */
export function VolumeMountList({ value, onChange, onDangerousPath }: VolumeMountListProps) {
  const [keyState, setKeyState] = useState(() => ({
    counter: value.length,
    keys: value.map((_, i) => i),
  }));

  // 危険パスのコールバックを呼び出す（既に通知済みのパスは再通知しない）
  const notifiedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 現在のvalueに含まれない通知済みパスをクリア（キャンセル等でパスが除去された場合に再通知可能にする）
    const currentPaths = new Set(value.map(m => m.hostPath));
    for (const path of notifiedPathsRef.current) {
      if (!currentPaths.has(path)) {
        notifiedPathsRef.current.delete(path);
      }
    }

    if (!onDangerousPath) return;

    for (const mount of value) {
      if (mount.hostPath && isDangerousPath(mount.hostPath) && !notifiedPathsRef.current.has(mount.hostPath)) {
        notifiedPathsRef.current.add(mount.hostPath);
        onDangerousPath(mount.hostPath);
      }
    }
  }, [value, onDangerousPath]);

  const handleAdd = () => {
    setKeyState(prev => ({
      counter: prev.counter + 1,
      keys: [...prev.keys, prev.counter],
    }));
    onChange([...value, { hostPath: '', containerPath: '', accessMode: 'rw' }]);
  };

  const handleRemove = (index: number) => {
    const removedPath = value[index]?.hostPath;
    if (removedPath) {
      notifiedPathsRef.current.delete(removedPath);
    }
    setKeyState(prev => ({
      ...prev,
      keys: prev.keys.filter((_, i) => i !== index),
    }));
    const newMounts = value.filter((_, i) => i !== index);
    onChange(newMounts);
  };

  const handleChange = (index: number, field: keyof VolumeMount, fieldValue: string) => {
    const newMounts = value.map((mount, i) => {
      if (i !== index) return mount;
      return { ...mount, [field]: fieldValue };
    });
    onChange(newMounts);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
        ボリュームマウント
      </h4>

      {value.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ボリュームマウントは設定されていません
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((mount, index) => {
            const { errors, warnings } = validateMount(mount);

            return (
              <div key={keyState.keys[index]} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mount.hostPath}
                    onChange={(e) => handleChange(index, 'hostPath', e.target.value)}
                    placeholder="/host/path"
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
                    -&gt;
                  </span>
                  <input
                    type="text"
                    value={mount.containerPath}
                    onChange={(e) => handleChange(index, 'containerPath', e.target.value)}
                    placeholder="/container/path"
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={mount.accessMode ?? 'rw'}
                    onChange={(e) => handleChange(index, 'accessMode', e.target.value)}
                    className="px-2 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rw">RW</option>
                    <option value="ro">RO</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    aria-label="削除"
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {errors.hostPath && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errors.hostPath}</p>
                )}
                {errors.containerPath && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errors.containerPath}</p>
                )}
                {warnings.hostPath && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{warnings.hostPath}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        <Plus className="h-4 w-4" />
        ボリュームを追加
      </button>
    </div>
  );
}
