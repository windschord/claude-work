'use client';

import { useDiffStore } from '@/store/diff';
import { FileChange } from '@/lib/api';

interface FileListProps {
  className?: string;
}

export default function FileList({ className = '' }: FileListProps) {
  const { diffResult, selectedFile, selectFile, isLoading } = useDiffStore();

  if (isLoading) {
    return (
      <div className={`bg-white border-r border-gray-200 overflow-y-auto ${className}`}>
        <div className="p-4 text-sm text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!diffResult || !diffResult.has_changes) {
    return (
      <div className={`bg-white border-r border-gray-200 overflow-y-auto ${className}`}>
        <div className="p-4 text-sm text-gray-500">変更されたファイルがありません</div>
      </div>
    );
  }

  const getStatusColor = (status: FileChange['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-600';
      case 'modified':
        return 'text-yellow-600';
      case 'deleted':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: FileChange['status']) => {
    switch (status) {
      case 'added':
        return 'A';
      case 'modified':
        return 'M';
      case 'deleted':
        return 'D';
      default:
        return '?';
    }
  };

  return (
    <div className={`bg-white border-r border-gray-200 overflow-y-auto ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">変更されたファイル</h3>
        <p className="text-xs text-gray-500 mt-1">
          {diffResult.files.length} 個のファイル
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {diffResult.files.map((file) => (
          <button
            key={file.path}
            onClick={() => selectFile(file.path === selectedFile ? null : file.path)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
              file.path === selectedFile ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold ${getStatusColor(file.status)}`}>
                {getStatusLabel(file.status)}
              </span>
              <span className="text-sm text-gray-800 truncate flex-1" title={file.path}>
                {file.path}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {file.additions > 0 && (
                <span className="text-green-600">+{file.additions}</span>
              )}
              {file.deletions > 0 && (
                <span className="text-red-600">-{file.deletions}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
