'use client';

import { useAppStore } from '@/store';

export function FileList() {
  const { diff, selectedFile, selectFile } = useAppStore();

  if (!diff) {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <p className="text-gray-500 dark:text-gray-400 text-sm">差分を読み込み中...</p>
      </div>
    );
  }

  if (diff.files.length === 0) {
    return (
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <p className="text-gray-500 dark:text-gray-400 text-sm">変更されたファイルはありません</p>
      </div>
    );
  }

  const getStatusIcon = (status: 'added' | 'modified' | 'deleted') => {
    switch (status) {
      case 'added':
        return '+';
      case 'modified':
        return '~';
      case 'deleted':
        return '-';
    }
  };

  const getStatusColor = (status: 'added' | 'modified' | 'deleted') => {
    switch (status) {
      case 'added':
        return 'text-green-600 dark:text-green-400';
      case 'modified':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'deleted':
        return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          変更されたファイル
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span className="text-green-600 dark:text-green-400">+{diff.totalAdditions}</span>
          {' / '}
          <span className="text-red-600 dark:text-red-400">-{diff.totalDeletions}</span>
        </p>
      </div>
      <div className="p-2">
        {diff.files.map((file) => {
          const isSelected = selectedFile === file.path;
          return (
            <button
              key={file.path}
              onClick={() => selectFile(file.path)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getStatusColor(
                file.status
              )} ${
                isSelected
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">{getStatusIcon(file.status)}</span>
                <span className="text-sm break-all">{file.path}</span>
              </div>
              <div className="text-xs mt-1 ml-5">
                <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
