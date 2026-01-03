'use client';

import { useState } from 'react';
import { ExternalLink, GitPullRequest, GitBranch } from 'lucide-react';
import { CreatePRDialog } from './CreatePRDialog';

interface PRSectionProps {
  sessionId: string;
  branchName: string;
  prUrl?: string | null;
  prNumber?: number | null;
  prStatus?: string | null;
  onPRCreated?: (pr: { url: string; number: number }) => void;
}

/**
 * PRセクションコンポーネント
 *
 * PRのステータス表示、リンク、作成ボタンを表示します。
 */
export function PRSection({
  sessionId,
  branchName,
  prUrl,
  prNumber,
  prStatus,
  onPRCreated,
}: PRSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateClick = () => {
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const handlePRCreated = (pr: { url: string; number: number }) => {
    setIsDialogOpen(false);
    onPRCreated?.(pr);
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <GitBranch className="w-4 h-4" />
        <span className="font-mono text-xs">{branchName}</span>
      </div>

      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      {prUrl && prNumber ? (
        <div className="flex items-center gap-2">
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <GitPullRequest className="w-4 h-4" />
            <span>#{prNumber}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          {prStatus && <PRStatusBadge status={prStatus} />}
        </div>
      ) : (
        <>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium
              text-white bg-green-600 hover:bg-green-700
              dark:bg-green-700 dark:hover:bg-green-600
              rounded-md transition-colors"
          >
            <GitPullRequest className="w-4 h-4" />
            <span>PRを作成</span>
          </button>

          <CreatePRDialog
            isOpen={isDialogOpen}
            sessionId={sessionId}
            branchName={branchName}
            onClose={handleDialogClose}
            onSuccess={handlePRCreated}
          />
        </>
      )}
    </div>
  );
}

interface PRStatusBadgeProps {
  status: string;
}

function PRStatusBadge({ status }: PRStatusBadgeProps) {
  const statusConfig = {
    open: {
      label: 'Open',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    merged: {
      label: 'Merged',
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    },
    closed: {
      label: 'Closed',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}
    >
      {config.label}
    </span>
  );
}
