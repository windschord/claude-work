import { useRouter } from 'next/navigation';
import { Session } from '@/lib/api';
import SessionStatusIcon from './SessionStatusIcon';

interface SessionListProps {
  sessions: Session[];
  isLoading: boolean;
}

export default function SessionList({ sessions, isLoading }: SessionListProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500">セッションがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => router.push(`/sessions/${session.id}`)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {session.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                ブランチ: {session.branch_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                作成日時: {new Date(session.created_at).toLocaleString('ja-JP')}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <SessionStatusIcon status={session.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
