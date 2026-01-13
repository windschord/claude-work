'use client';

import { useState } from 'react';
import { Play, Square, Trash2, Terminal, AlertCircle } from 'lucide-react';
import type { DockerSession, DockerSessionStatus } from '@/types/docker-session';

interface DockerSessionCardProps {
  session: DockerSession;
  onStart: (sessionId: string) => Promise<void>;
  onStop: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  onConnect: (sessionId: string) => void;
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: DockerSessionStatus }) {
  const statusConfig: Record<DockerSessionStatus, { color: string; label: string }> = {
    creating: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Creating' },
    running: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Running' },
    stopped: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: 'Stopped' },
    error: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Docker session card component
 *
 * Displays session information and provides action buttons.
 */
export function DockerSessionCard({
  session,
  onStart,
  onStop,
  onDelete,
  onConnect,
}: DockerSessionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      await onStart(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStopping) return;
    setIsStopping(true);
    setError(null);
    try {
      await onStop(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    } finally {
      setIsStopping(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (!confirm(`Are you sure you want to delete "${session.name}"?`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
      setIsDeleting(false);
    }
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnect(session.id);
  };

  const canStart = session.status === 'stopped';
  const canStop = session.status === 'running';
  const canConnect = session.status === 'running' && session.containerId;
  const isProcessing = isDeleting || isStarting || isStopping;

  return (
    <div
      data-testid="session-card"
      data-session-id={session.id}
      className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{session.name}</h3>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex items-center gap-1">
          {canConnect && (
            <button
              data-testid="connect-button"
              onClick={handleConnect}
              className="p-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              title="Connect to terminal"
            >
              <Terminal size={18} />
            </button>
          )}
          {canStart && (
            <button
              data-testid="start-button"
              onClick={handleStart}
              disabled={isProcessing}
              className="p-2 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors disabled:opacity-50"
              title="Start session"
            >
              <Play size={18} />
            </button>
          )}
          {canStop && (
            <button
              data-testid="stop-button"
              onClick={handleStop}
              disabled={isProcessing}
              className="p-2 text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors disabled:opacity-50"
              title="Stop session"
            >
              <Square size={18} />
            </button>
          )}
          <button
            data-testid="delete-button"
            onClick={handleDelete}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete session"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <p className="truncate" title={session.repository?.name}>
          <span className="font-medium">Repo:</span> {session.repository?.name} ({session.repository?.type})
        </p>
        <p>
          <span className="font-medium">Branch:</span> {session.branch}
        </p>
        <p>
          <span className="font-medium">Created:</span> {new Date(session.createdAt).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
