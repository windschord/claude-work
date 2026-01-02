'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, WebSocketMessage, Message } from '@/lib/api';
import { useMessagesStore } from '@/store/messages';
import { useDiffStore } from '@/store/diff';
import { useGitOpsStore } from '@/store/gitOps';
import { useWebSocket } from '@/hooks/useWebSocket';
import MessageList from '@/components/session/MessageList';
import InputForm from '@/components/session/InputForm';
import PermissionDialog from '@/components/session/PermissionDialog';
import SessionHeader from '@/components/session/SessionHeader';
import ConnectionStatus from '@/components/session/ConnectionStatus';
import FileList from '@/components/git/FileList';
import DiffViewer from '@/components/git/DiffViewer';
import RebaseButton from '@/components/git/RebaseButton';
import MergeModal from '@/components/git/MergeModal';
import ConflictDialog from '@/components/git/ConflictDialog';
import { CommitHistory } from '@/components/git/CommitHistory';
import { Session } from '@/lib/api';
import RunScriptPanel from '@/components/session/RunScriptPanel';
import Terminal from '@/components/session/Terminal';

type TabType = 'chat' | 'changes' | 'history' | 'scripts' | 'terminal';

// ユニークIDを生成するヘルパー関数
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    messages,
    isLoading,
    error,
    pendingPermission,
    sessionStatus,
    fetchMessages,
    sendMessage,
    respondToPermission,
    clearError,
    clearMessages,
    addMessage,
    setSessionStatus,
    setPendingPermission,
    setError,
  } = useMessagesStore();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const { fetchDiff, clearDiff } = useDiffStore();
  const { error: gitOpsError, clearError: clearGitOpsError } = useGitOpsStore();

  // WebSocketメッセージハンドラ
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'assistant_output':
        addMessage({
          id: generateId(),
          session_id: sessionId,
          role: 'assistant',
          content: message.content,
          created_at: new Date().toISOString(),
        });
        break;
      case 'permission_request':
        setPendingPermission({
          id: message.permission_id,
          type: 'permission',
          description: message.description,
        });
        break;
      case 'session_status':
        setSessionStatus(message.status);
        setSession((prev) => prev ? { ...prev, status: message.status } : null);
        break;
      case 'error':
        setError(message.message);
        break;
    }
  }, [sessionId, addMessage, setPendingPermission, setSessionStatus, setError]);

  // WebSocket接続
  const {
    isConnected,
    isConnecting,
    reconnectAttempts,
    sendMessage: wsSendMessage,
  } = useWebSocket({
    sessionId,
    onMessage: handleWebSocketMessage,
    enabled: !!sessionId,
  });

  // セッションデータとメッセージの初期読み込み
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await api.getSession(sessionId);
        setSession(sessionData);
        setSessionStatus(sessionData.status);
        setSessionLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'セッションの取得に失敗しました';
        setSessionError(errorMessage);
        setSessionLoading(false);
      }
    };

    loadSession();
    // 初期メッセージの取得（WebSocketが接続される前の履歴を取得）
    fetchMessages(sessionId);

    return () => {
      clearMessages();
      clearDiff();
    };
  }, [sessionId, clearMessages, clearDiff, fetchMessages, setSessionStatus]);

  useEffect(() => {
    if (activeTab === 'changes' && sessionId) {
      fetchDiff(sessionId);
    }
  }, [activeTab, sessionId, fetchDiff]);

  const handleSendMessage = async (content: string) => {
    // WebSocket経由で送信
    if (isConnected) {
      // ユーザーメッセージをローカルに追加
      addMessage({
        id: generateId(),
        session_id: sessionId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      });

      wsSendMessage({
        type: 'user_input',
        content,
      });
    } else {
      // フォールバック: REST API経由で送信
      await sendMessage(sessionId, content);
    }
  };

  const handleStopSession = async () => {
    setStopLoading(true);
    try {
      await api.stopSession(sessionId);
      const updatedSession = await api.getSession(sessionId);
      setSession(updatedSession);
      setSessionStatus(updatedSession.status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの停止に失敗しました';
      setSessionError(errorMessage);
    } finally {
      setStopLoading(false);
    }
  };

  const handleApprovePermission = async () => {
    if (!pendingPermission) return;

    // WebSocket経由で送信
    if (isConnected) {
      wsSendMessage({
        type: 'permission_response',
        permission_id: pendingPermission.id,
        approved: true,
      });
      setPendingPermission(null);
    } else {
      // フォールバック: REST API経由で送信
      try {
        await respondToPermission(sessionId, pendingPermission.id, true);
      } catch (error) {
        console.error('権限承認エラー:', error);
      }
    }
  };

  const handleRejectPermission = async () => {
    if (!pendingPermission) return;

    // WebSocket経由で送信
    if (isConnected) {
      wsSendMessage({
        type: 'permission_response',
        permission_id: pendingPermission.id,
        approved: false,
      });
      setPendingPermission(null);
    } else {
      // フォールバック: REST API経由で送信
      try {
        await respondToPermission(sessionId, pendingPermission.id, false);
      } catch (error) {
        console.error('権限拒否エラー:', error);
      }
    }
  };

  const handleRebaseSuccess = () => {
    fetchDiff(sessionId);
  };

  const handleMergeSuccess = () => {
    if (session) {
      router.push(`/projects/${session.project_id}`);
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

      {/* 接続状態インジケーター */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <ConnectionStatus
          isConnected={isConnected}
          isConnecting={isConnecting}
          reconnectAttempts={reconnectAttempts}
        />
      </div>

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

      {gitOpsError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800">{gitOpsError}</p>
            <button
              onClick={clearGitOpsError}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            チャット
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'changes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            変更
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            履歴
          </button>
          <button
            onClick={() => setActiveTab('scripts')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'scripts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            スクリプト
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'terminal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ターミナル
          </button>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            <MessageList messages={messages} isLoading={isLoading} />
            <InputForm
              onSubmit={handleSendMessage}
              isLoading={isLoading}
              disabled={
                !isConnected ||
                (sessionStatus !== 'waiting_input' && sessionStatus !== 'running')
              }
            />
          </div>
        ) : activeTab === 'changes' ? (
          <div className="flex flex-col h-full">
            <div className="border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex gap-3">
                <RebaseButton sessionId={sessionId} onSuccess={handleRebaseSuccess} />
                <button
                  onClick={() => setIsMergeModalOpen(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  スカッシュしてマージ
                </button>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <FileList className="w-80 flex-shrink-0" />
              <DiffViewer className="flex-1" />
            </div>
          </div>
        ) : activeTab === 'scripts' ? (
          <div className="h-full">
            <RunScriptPanel sessionId={sessionId} projectId={session.project_id} />
          </div>
        ) : activeTab === 'terminal' ? (
          <div className="h-full">
            <Terminal sessionId={sessionId} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-6 py-4">
            <CommitHistory sessionId={sessionId} />
          </div>
        )}
      </div>

      <PermissionDialog
        permission={pendingPermission}
        onApprove={handleApprovePermission}
        onReject={handleRejectPermission}
        isLoading={isLoading}
      />

      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        sessionId={sessionId}
        onSuccess={handleMergeSuccess}
      />

      <ConflictDialog />
    </div>
  );
}
