'use client';

import { Session } from '@/store';
import { SessionCard } from './SessionCard';

interface SessionListProps {
  sessions: Session[];
  onSessionClick: (sessionId: string) => void;
}

export function SessionList({ sessions, onSessionClick }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">セッションがありません</p>
        <p className="text-sm text-gray-400 mt-2">
          下のフォームから新しいセッションを作成してください
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} onClick={onSessionClick} />
      ))}
    </div>
  );
}
