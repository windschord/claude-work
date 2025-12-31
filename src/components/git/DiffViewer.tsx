'use client';

import { useAppStore } from '@/store';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// react-diff-viewer-continuedを動的インポート（SSRを無効化）
// ESMモジュールのdefault exportを明示的に取得
const ReactDiffViewer = dynamic(
  () => import('react-diff-viewer-continued').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500 dark:text-gray-400">差分ビューアを読み込み中...</p>
      </div>
    ),
  }
);

/**
 * Diffビューアコンポーネント
 *
 * 選択されたファイルのGit差分を視覚的に表示します。
 * react-diff-viewer-continuedを使用して、行ごとの変更を色分けして表示します。
 *
 * @returns Diffビューアのジェーエスエックス要素
 */
export function DiffViewer() {
  const { diff, selectedFile, isDiffLoading, diffError } = useAppStore();

  const selectedFileData = useMemo(() => {
    if (!diff || !selectedFile) return null;
    return diff.files.find((f) => f.path === selectedFile);
  }, [diff, selectedFile]);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[DiffViewer] State:', { diff, selectedFile, selectedFileData, isDiffLoading, diffError });
  }

  // ローディング中の表示
  if (isDiffLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 dark:text-gray-400">差分を読み込み中...</p>
      </div>
    );
  }

  // エラー時の表示
  if (diffError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">{diffError}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ページを再読み込みするか、もう一度お試しください
          </p>
        </div>
      </div>
    );
  }

  // diffがnullまたはundefinedの場合（初期状態）
  if (!diff) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DiffViewer] diff is null or undefined, but not loading and no error');
    }
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 dark:text-gray-400">Diffタブを選択すると差分を表示します</p>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 dark:text-gray-400">ファイルを選択してください</p>
      </div>
    );
  }

  if (!selectedFileData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 dark:text-gray-400">選択されたファイルの差分が見つかりません</p>
      </div>
    );
  }

  const getStatusBadge = (status: 'added' | 'modified' | 'deleted') => {
    const baseClasses = 'px-2 py-1 rounded text-xs font-semibold';
    switch (status) {
      case 'added':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
      case 'modified':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      case 'deleted':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
    }
  };

  const getStatusLabel = (status: 'added' | 'modified' | 'deleted') => {
    switch (status) {
      case 'added':
        return '追加';
      case 'modified':
        return '変更';
      case 'deleted':
        return '削除';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ファイルヘッダー */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <span className={getStatusBadge(selectedFileData.status)}>
            {getStatusLabel(selectedFileData.status)}
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1">
            {selectedFileData.path}
          </h3>
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 dark:text-green-400">
              +{selectedFileData.additions}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{selectedFileData.deletions}
            </span>
          </div>
        </div>
      </div>

      {/* Diffビューア */}
      <div className="flex-1 overflow-auto">
        <ReactDiffViewer
          oldValue={selectedFileData.oldContent}
          newValue={selectedFileData.newContent}
          splitView={false}
          useDarkTheme={false}
          showDiffOnly={false}
          styles={{
            variables: {
              light: {
                diffViewerBackground: '#ffffff',
                addedBackground: '#e6ffec',
                addedColor: '#24292e',
                removedBackground: '#ffeef0',
                removedColor: '#24292e',
                wordAddedBackground: '#acf2bd',
                wordRemovedBackground: '#fdb8c0',
                addedGutterBackground: '#cdffd8',
                removedGutterBackground: '#ffdce0',
                gutterBackground: '#f6f8fa',
                gutterBackgroundDark: '#f3f4f6',
                highlightBackground: '#fffbdd',
                highlightGutterBackground: '#fff5b1',
              },
            },
          }}
        />
      </div>
    </div>
  );
}
