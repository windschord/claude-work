'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store';
import { useScriptLogStore } from '@/store/script-logs';
import { useNotificationStore } from '@/store/notification';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AuthGuard } from '@/components/AuthGuard';
import { MainLayout } from '@/components/layout/MainLayout';
import MessageList from '@/components/session/MessageList';
import InputForm from '@/components/session/InputForm';
import PermissionDialog from '@/components/session/PermissionDialog';
import { FileList } from '@/components/git/FileList';
import { DiffViewer } from '@/components/git/DiffViewer';
import { RebaseButton } from '@/components/git/RebaseButton';
import { MergeModal } from '@/components/git/MergeModal';
import { ConflictDialog } from '@/components/git/ConflictDialog';
import { DeleteWorktreeDialog } from '@/components/git/DeleteWorktreeDialog';
import { CommitHistory } from '@/components/git/CommitHistory';
import { ScriptsPanel } from '@/components/scripts/ScriptsPanel';
import { ProcessStatus } from '@/components/sessions/ProcessStatus';
import { Toaster, toast } from 'react-hot-toast';
import type { ServerMessage } from '@/types/websocket';

// TerminalPanelをSSRなしで動的インポート（xtermはブラウザ専用）
const TerminalPanel = dynamic(
  () => import('@/components/sessions/TerminalPanel').then((mod) => mod.TerminalPanel),
  { ssr: false }
);

/**
 * セッション詳細ページ
 *
 * セッションの対話履歴、Git差分、操作ボタンを含む詳細ビューを提供します。
 * 対話タブとDiffタブを切り替えて表示でき、WebSocketでリアルタイム更新を受信します。
 * 権限リクエスト、コンフリクト通知、マージ、worktree削除の機能を含みます。
 *
 * @returns セッション詳細ページのJSX要素
 */
export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    currentSession,
    messages,
    permissionRequest,
    conflictFiles,
    fetchSessionDetail,
    fetchDiff,
    stopSession,
    deleteSession,
    checkAuth,
    handleWebSocketMessage,
  } = useAppStore();

  const { permission, requestPermission } = useNotificationStore();

  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'diff' | 'commits' | 'terminal' | 'scripts'>('chat');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [isDeleteWorktreeDialogOpen, setIsDeleteWorktreeDialogOpen] = useState(false);
  const [processRunning, setProcessRunning] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);

  // WebSocketメッセージハンドラ（useCallbackで最適化）
  const onMessage = useCallback(
    (message: ServerMessage) => {
      handleWebSocketMessage(message);

      // errorメッセージをトースト通知で表示
      if (message.type === 'error') {
        toast.error(message.content);
      }

      // スクリプトログメッセージを処理（script-logsストアを更新）
      if (message.type === 'run_script_log') {
        const { addLog } = useScriptLogStore.getState();
        addLog(message.runId, {
          timestamp: message.timestamp,
          level: message.level,
          content: message.content,
        });
      } else if (message.type === 'run_script_exit') {
        const { endRun } = useScriptLogStore.getState();
        endRun(message.runId, message.exitCode, message.signal ?? null, message.executionTime);
      }
    },
    [handleWebSocketMessage]
  );

  // WebSocket接続
  const { send, status: wsStatus } = useWebSocket(sessionId, onMessage);

  // 初回データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchSessionDetail(sessionId);
      } catch (error) {
        console.error('Failed to fetch session detail:', error);
      }
    };

    fetchData();
  }, [sessionId, fetchSessionDetail]);

  // プロセス状態確認関数
  const checkProcessStatus = useCallback(async () => {
    try {
      setProcessLoading(true);
      const response = await fetch(`/api/sessions/${sessionId}/process`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProcessRunning(data.running);
      } else {
        console.error('Failed to check process status:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to check process status:', error);
    } finally {
      setProcessLoading(false);
    }
  }, [sessionId]);

  // 初回およびsessionId変更時にプロセス状態を確認
  useEffect(() => {
    checkProcessStatus();
  }, [checkProcessStatus]);

  // WebSocket接続確立時にもプロセス状態を確認（REQ-083）
  useEffect(() => {
    if (wsStatus === 'connected') {
      checkProcessStatus();
    }
  }, [wsStatus, checkProcessStatus]);

  // Show permission dialog when permission request is available
  useEffect(() => {
    if (permissionRequest) {
      setIsPermissionDialogOpen(true);
    }
  }, [permissionRequest]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Request notification permission on first visit
  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Show conflict dialog when conflict files are detected
  useEffect(() => {
    if (conflictFiles && conflictFiles.length > 0) {
      setIsConflictDialogOpen(true);
    }
  }, [conflictFiles]);

  // Fetch diff when diff tab is selected
  useEffect(() => {
    if (activeTab === 'diff') {
      const fetchDiffData = async () => {
        try {
          await fetchDiff(sessionId);
        } catch (error) {
          console.error('Failed to fetch diff:', error);
          // エラーはDiffViewer側でdiffErrorとして表示されるためtoastは不要
        }
      };
      fetchDiffData();
    }
  }, [activeTab, sessionId, fetchDiff]);

  const handleRestartProcess = useCallback(async () => {
    try {
      setProcessLoading(true);
      const response = await fetch(`/api/sessions/${sessionId}/process`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProcessRunning(data.running);
        toast.success('プロセスを起動しました');
      } else {
        const errorData = await response.json();
        toast.error(`プロセス起動に失敗しました: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to restart process:', error);
      toast.error('プロセス起動に失敗しました');
    } finally {
      setProcessLoading(false);
    }
  }, [sessionId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      // プロセスが停止している場合は送信を阻止
      if (!processRunning) {
        toast.error('プロセスが停止しています。再起動してください');
        return;
      }

      try {
        // WebSocket経由でメッセージ送信
        send({ type: 'input', content });
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [send, processRunning]
  );

  const handleApprove = useCallback(
    (permissionId: string) => {
      try {
        // WebSocket経由で権限承認を送信
        send({ type: 'approve', requestId: permissionId });
        // ダイアログを閉じる
        setIsPermissionDialogOpen(false);
      } catch (error) {
        console.error('Failed to approve permission:', error);
      }
    },
    [send]
  );

  const handleReject = useCallback(
    (permissionId: string) => {
      try {
        // WebSocket経由で権限拒否を送信
        send({ type: 'deny', requestId: permissionId });
        // ダイアログを閉じる
        setIsPermissionDialogOpen(false);
      } catch (error) {
        console.error('Failed to reject permission:', error);
      }
    },
    [send]
  );

  const handleStopSession = async () => {
    try {
      await stopSession(sessionId);
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  };

  const handleMergeSuccess = () => {
    setIsMergeModalOpen(false);
    setIsDeleteWorktreeDialogOpen(true);
  };

  const handleDeleteWorktree = async () => {
    try {
      await deleteSession(sessionId);
      setIsDeleteWorktreeDialogOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Failed to delete worktree:', error);
    }
  };

  const handleKeepWorktree = () => {
    setIsDeleteWorktreeDialogOpen(false);
  };

  if (!currentSession) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">読み込み中...</p>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentSession.name}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ステータス: {currentSession.status} | モデル: {currentSession.model}
                  {' | '}
                  <span
                    className={`${
                      wsStatus === 'connected'
                        ? 'text-green-500'
                        : wsStatus === 'connecting'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    }`}
                  >
                    WebSocket: {wsStatus}
                  </span>
                </p>
                <ProcessStatus
                  running={processRunning}
                  loading={processLoading}
                  onRestart={handleRestartProcess}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                戻る
              </button>
              {(currentSession.status === 'running' || currentSession.status === 'waiting_input') && (
                <button
                  onClick={handleStopSession}
                  className="px-4 py-2 min-h-[44px] rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  停止
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                対話
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'diff'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Diff
              </button>
              <button
                onClick={() => setActiveTab('commits')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'commits'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Commits
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'terminal'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Terminal
              </button>
              <button
                onClick={() => setActiveTab('scripts')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'scripts'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Scripts
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {/*
           * 注意: すべてのタブコンテンツはDOMに常にレンダリングされ、CSSのhiddenクラスで非表示にしています。
           * これは特にTerminalタブのためのアーキテクチャ上の決定です。
           * XTerm.jsターミナルは一度初期化されると、DOMから削除されると状態が失われます。
           * 条件付きレンダリングではなくCSS非表示を使用することで、タブ切り替え時も
           * ターミナルの接続状態と履歴が維持されます。
           */}
          {/* Chat Tab */}
          <div className={`flex flex-col flex-1 ${activeTab === 'chat' ? '' : 'hidden'}`}>
            {/* Messages */}
            <MessageList messages={messages} />

            {/* Input Form */}
            <InputForm
              onSubmit={handleSendMessage}
              disabled={currentSession.status !== 'running' && currentSession.status !== 'waiting_input'}
            />
          </div>

          {/* Diff Tab */}
          <div className={`flex-1 flex flex-col overflow-hidden ${activeTab === 'diff' ? '' : 'hidden'}`}>
            {/* Git Operations Buttons */}
            <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex gap-3">
              <RebaseButton sessionId={sessionId} />
              <button
                onClick={() => setIsMergeModalOpen(true)}
                className="bg-green-500 text-white rounded px-4 py-2 min-h-[44px] hover:bg-green-600 transition-colors"
              >
                スカッシュしてマージ
              </button>
            </div>
            {/* Diff Display */}
            <div className="flex-1 flex overflow-hidden">
              <FileList />
              <DiffViewer />
            </div>
          </div>

          {/* Commits Tab */}
          <div className={`flex-1 overflow-auto p-4 ${activeTab === 'commits' ? '' : 'hidden'}`}>
            {/* Commit History */}
            <CommitHistory sessionId={sessionId} />
          </div>

          {/* Terminal Tab */}
          <div className={`flex-1 overflow-hidden ${activeTab === 'terminal' ? '' : 'hidden'}`}>
            {/* Terminal */}
            <TerminalPanel sessionId={sessionId} />
          </div>

          {/* Scripts Tab */}
          <div className={`flex-1 overflow-hidden ${activeTab === 'scripts' ? '' : 'hidden'}`}>
            {/* Scripts */}
            <ScriptsPanel sessionId={sessionId} projectId={currentSession.project_id} />
          </div>

          {/* Permission Dialog */}
          <PermissionDialog
            isOpen={isPermissionDialogOpen}
            permission={permissionRequest}
            onApprove={handleApprove}
            onReject={handleReject}
            onClose={() => setIsPermissionDialogOpen(false)}
          />

          {/* Merge Modal */}
          <MergeModal
            isOpen={isMergeModalOpen}
            sessionId={sessionId}
            onClose={() => setIsMergeModalOpen(false)}
            onSuccess={handleMergeSuccess}
          />

          {/* Conflict Dialog */}
          <ConflictDialog
            isOpen={isConflictDialogOpen}
            conflictFiles={conflictFiles || []}
            onClose={() => setIsConflictDialogOpen(false)}
          />

          {/* Delete Worktree Dialog */}
          <DeleteWorktreeDialog
            isOpen={isDeleteWorktreeDialogOpen}
            onDelete={handleDeleteWorktree}
            onKeep={handleKeepWorktree}
          />

          {/* Toast Notifications */}
          <Toaster position="top-right" />
        </div>
      </MainLayout>
    </AuthGuard>
  );
}
