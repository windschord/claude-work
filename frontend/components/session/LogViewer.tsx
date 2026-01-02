'use client';

import { useState, useMemo } from 'react';

interface LogViewerProps {
  output: string;
}

type LogLevel = 'info' | 'warn' | 'error';

interface LogLine {
  text: string;
  level: LogLevel;
  lineNumber: number;
}

function detectLogLevel(line: string): LogLevel {
  const lowerLine = line.toLowerCase();

  // エラーを検出
  if (lowerLine.includes('error') || lowerLine.includes('fail')) {
    return 'error';
  }

  // 警告を検出
  if (lowerLine.includes('warn')) {
    return 'warn';
  }

  // デフォルトは情報
  return 'info';
}

function highlightText(text: string, searchText: string): JSX.Element {
  if (!searchText.trim()) {
    return <>{text}</>;
  }

  const parts: JSX.Element[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerSearch);
  let key = 0;

  while (matchIndex !== -1) {
    // マッチ前のテキスト
    if (matchIndex > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex, matchIndex)}</span>);
    }

    // マッチ部分
    parts.push(
      <span key={`match-${key++}`} className="bg-yellow-300 text-gray-900">
        {text.substring(matchIndex, matchIndex + searchText.length)}
      </span>
    );

    lastIndex = matchIndex + searchText.length;
    matchIndex = lowerText.indexOf(lowerSearch, lastIndex);
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function LogViewer({ output }: LogViewerProps) {
  const [filters, setFilters] = useState({
    info: true,
    warn: true,
    error: true,
  });
  const [searchText, setSearchText] = useState('');

  // ログ行を解析
  const logLines = useMemo<LogLine[]>(() => {
    if (!output) return [];

    const lines = output.split('\n');
    return lines.map((text, index) => ({
      text,
      level: detectLogLevel(text),
      lineNumber: index + 1,
    }));
  }, [output]);

  // フィルタリングと検索を適用
  const filteredLines = useMemo(() => {
    return logLines.filter((line) => {
      // ログレベルフィルタ
      if (!filters[line.level]) {
        return false;
      }

      // テキスト検索
      if (searchText.trim() && !line.text.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [logLines, filters, searchText]);

  const toggleFilter = (level: LogLevel) => {
    setFilters((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
      default:
        return 'text-gray-100';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* フィルターUI */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.info}
              onChange={() => toggleFilter('info')}
              className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Info</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.warn}
              onChange={() => toggleFilter('warn')}
              className="rounded border-gray-600 text-yellow-500 focus:ring-yellow-500"
            />
            <span className="text-sm text-gray-300">Warn</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.error}
              onChange={() => toggleFilter('error')}
              className="rounded border-gray-600 text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-gray-300">Error</span>
          </label>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* ログ出力 */}
      <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
        {filteredLines.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {output ? 'フィルタ条件に一致する行がありません' : '(出力なし)'}
          </div>
        ) : (
          <div className="font-mono text-sm">
            {filteredLines.map((line) => (
              <div key={line.lineNumber} className="hover:bg-gray-800/50">
                <span className={`${getLevelColor(line.level)} whitespace-pre-wrap break-words`}>
                  {highlightText(line.text, searchText)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
