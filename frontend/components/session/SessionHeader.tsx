'use client';

import Link from 'next/link';
import { Session } from '@/lib/api';
import SessionStatusIcon from '@/components/sessions/SessionStatusIcon';

interface SessionHeaderProps {
  session: Session;
  projectId: string;
  onStop: () => void;
  isLoading: boolean;
}

export default function SessionHeader({ session, projectId, onStop, isLoading }: SessionHeaderProps) {
  const canStop = session.status === 'running' || session.status === 'waiting_input';

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${projectId}`}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 戻る
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{session.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <SessionStatusIcon status={session.status} />
              <span className="text-sm text-gray-500">{session.branch_name}</span>
            </div>
          </div>
        </div>
        {canStop && (
          <button
            onClick={onStop}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '停止中...' : '停止'}
          </button>
        )}
      </div>
    </div>
  );
}
