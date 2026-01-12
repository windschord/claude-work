'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import type { DockerSession } from '@/types/docker-session';
import { DockerSessionCard } from './DockerSessionCard';

interface DockerSessionListProps {
  sessions: DockerSession[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onStart: (sessionId: string) => Promise<void>;
  onStop: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  onConnect: (sessionId: string) => void;
}

/**
 * Docker session list component
 *
 * Displays a list of Docker-based sessions with actions.
 */
export function DockerSessionList({
  sessions,
  loading,
  error,
  onRefresh,
  onStart,
  onStop,
  onDelete,
  onConnect,
}: DockerSessionListProps) {
  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={16} className="mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No sessions found</p>
        <p className="text-sm text-gray-400 mt-2">
          Create a new session to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Session grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <DockerSessionCard
            key={session.id}
            session={session}
            onStart={onStart}
            onStop={onStop}
            onDelete={onDelete}
            onConnect={onConnect}
          />
        ))}
      </div>
    </div>
  );
}
