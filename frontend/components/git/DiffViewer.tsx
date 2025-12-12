'use client';

import { useDiffStore } from '@/store/diff';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerProps {
  className?: string;
}

interface ParsedDiff {
  fileName: string;
  oldContent: string;
  newContent: string;
}

function parseUnifiedDiff(diffContent: string): ParsedDiff[] {
  const files: ParsedDiff[] = [];
  const lines = diffContent.split('\n');

  let currentFile: ParsedDiff | null = null;
  let oldLines: string[] = [];
  let newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ファイル名の検出 (diff --git a/file b/file)
    if (line.startsWith('diff --git')) {
      // 前のファイルを保存
      if (currentFile) {
        currentFile.oldContent = oldLines.join('\n');
        currentFile.newContent = newLines.join('\n');
        files.push(currentFile);
      }

      // 新しいファイルを開始
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      currentFile = {
        fileName: match ? match[2] : 'unknown',
        oldContent: '',
        newContent: '',
      };
      oldLines = [];
      newLines = [];
    }
    // @@ で始まるハンクヘッダーはスキップ
    else if (line.startsWith('@@')) {
      continue;
    }
    // --- や +++ で始まるファイルヘッダーはスキップ
    else if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }
    // 削除行
    else if (line.startsWith('-')) {
      oldLines.push(line.substring(1));
    }
    // 追加行
    else if (line.startsWith('+')) {
      newLines.push(line.substring(1));
    }
    // コンテキスト行（変更なし）
    else if (line.startsWith(' ')) {
      const content = line.substring(1);
      oldLines.push(content);
      newLines.push(content);
    }
  }

  // 最後のファイルを保存
  if (currentFile) {
    currentFile.oldContent = oldLines.join('\n');
    currentFile.newContent = newLines.join('\n');
    files.push(currentFile);
  }

  return files;
}

export default function DiffViewer({ className = '' }: DiffViewerProps) {
  const { diffResult, selectedFile, isLoading, error } = useDiffStore();

  if (isLoading) {
    return (
      <div className={`bg-gray-50 overflow-y-auto ${className}`}>
        <div className="p-6 text-center text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-50 overflow-y-auto ${className}`}>
        <div className="p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!diffResult || !diffResult.has_changes) {
    return (
      <div className={`bg-gray-50 overflow-y-auto ${className}`}>
        <div className="p-6 text-center text-gray-500">変更がありません</div>
      </div>
    );
  }

  const parsedDiffs = parseUnifiedDiff(diffResult.diff_content);

  // ファイルが選択されている場合はそのファイルのみ表示
  const diffsToShow = selectedFile
    ? parsedDiffs.filter(diff => diff.fileName === selectedFile)
    : parsedDiffs;

  if (diffsToShow.length === 0) {
    return (
      <div className={`bg-gray-50 overflow-y-auto ${className}`}>
        <div className="p-6 text-center text-gray-500">
          選択されたファイルのdiffが見つかりません
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 overflow-y-auto ${className}`}>
      {diffsToShow.map((diff, index) => (
        <div key={index} className="mb-4">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
            <h4 className="text-sm font-mono text-gray-700">{diff.fileName}</h4>
          </div>
          <ReactDiffViewer
            oldValue={diff.oldContent}
            newValue={diff.newContent}
            splitView={false}
            useDarkTheme={false}
            hideLineNumbers={false}
            showDiffOnly={true}
          />
        </div>
      ))}
    </div>
  );
}
