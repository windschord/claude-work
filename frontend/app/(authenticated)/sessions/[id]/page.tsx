'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useMessagesStore } from '@/store/messages';
import MessageList from '@/components/session/MessageList';
import InputForm from '@/components/session/InputForm';
import PermissionDialog from '@/components/session/PermissionDialog';
import SessionHeader from '@/components/session/SessionHeader';
import { Session } from '@/lib/api';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    messages,
    isLoading,
    error,
    pendingPermission,
    fetchMessages,
    sendMessage,
    respondToPermission,
    clearError,
    clearMessages,
  } = useMessagesStore();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [stopLoading, setStopLoading] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await api.getSession(sessionId);
        setSession(sessionData);
        setSessionLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'セッションの取得に失敗しました';
        setSessionError(errorMessage);
        setSessionLoading(false);
      }
    };

    loadSession();

    return () => {
      clearMessages();
    };
  }, [sessionId, clearMessages]);

  useEffect(() => {
    if (!sessionId) return;

    fetchMessages(sessionId);

    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(sessionId);
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId, fetchMessages]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(sessionId, content);
  };

  const handleStopSession = async () => {
    setStopLoading(true);
    try {
      await api.stopSession(sessionId);
      const updatedSession = await api.getSession(sessionId);
      setSession(updatedSession);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの停止に失敗しました';
      setSessionError(errorMessage);
    } finally {
      setStopLoading(false);
    }
  };

  const handleApprovePermission = async () => {
    if (!pendingPermission) return;
    try {
      await respondToPermission(sessionId, pendingPermission.id, true);
    } catch (error) {
      console.error('権限承認エラー:', error);
    }
  };

  const handleRejectPermission = async () => {
    if (!pendingPermission) return;
    try {
      await respondToPermission(sessionId, pendingPermission.id, false);
    } catch (error) {
      console.error('権限拒否エラー:', error);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-red-600 mb-4">{sessionError || 'セッションが見つかりません'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <SessionHeader
        session={session}
        projectId={session.project_id}
        onStop={handleStopSession}
        isLoading={stopLoading}
      />

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
        <InputForm
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          disabled={session.status !== 'waiting_input' && session.status !== 'running'}
        />
      </div>

      <PermissionDialog
        permission={pendingPermission}
        onApprove={handleApprovePermission}
        onReject={handleRejectPermission}
        isLoading={isLoading}
      />
    </div>
  );
}
