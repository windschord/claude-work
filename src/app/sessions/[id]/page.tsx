'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { useScriptLogStore } from '@/store/script-logs';
import { useNotificationStore } from '@/store/notification';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AuthGuard } from '@/components/AuthGuard';
import { MainLayout } from '@/components/layout/MainLayout';
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
// 静的インポート（ただしSSR時は動作しないxtermを遅延レンダリング）
// Note: 動的インポートは開発モードでwebpackのチャンク問題が発生するため、
// 静的インポートを使用し、クライアントサイドでのみレンダリングする
import { TerminalPanel } from '@/components/sessions/TerminalPanel';
import { ClaudeTerminalPanel } from '@/components/sessions/ClaudeTerminalPanel';

// ローディングコンポーネント
const TerminalLoading = () => (
  <div className="flex items-center justify-center h-full">
    <p className="text-gray-500 dark:text-gray-400">Loading terminal...</p>
  </div>
);

interface LazyTerminalProps {
  sessionId: string;
  isVisible?: boolean;
}

// クライアントサイドでのみレンダリングするラッパー
function LazyTerminalPanel({ sessionId }: LazyTerminalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <TerminalLoading />;
  return <TerminalPanel sessionId={sessionId} />;
}

function LazyClaudeTerminalPanel({ sessionId, isVisible = true }: LazyTerminalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <TerminalLoading />;
  return <ClaudeTerminalPanel sessionId={sessionId} isVisible={isVisible} />;
}

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
    conflictFiles,
    fetchSessionDetail,
    fetchDiff,
    stopSession,
    deleteSession,
    checkAuth,
    handleWebSocketMessage,
  } = useAppStore();

  const { permission, requestPermission } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<'claude' | 'shell' | 'diff' | 'commits' | 'scripts'>('claude');
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

      // ライフサイクルイベント処理
      if (message.type === 'process_paused') {
        const reasonText = message.reason === 'idle_timeout'
          ? 'アイドルタイムアウト'
          : message.reason === 'server_shutdown'
          ? 'サーバーシャットダウン'
          : '手動停止';
        toast(`セッションが一時停止しました: ${reasonText}`, { icon: '⏸️' });
        setProcessRunning(false);
      } else if (message.type === 'process_resumed') {
        const historyText = message.resumedWithHistory ? '（会話履歴を復元）' : '';
        toast.success(`セッションを再開しました${historyText}`);
        setProcessRunning(true);
      } else if (message.type === 'server_shutdown') {
        toast.error(`サーバーがシャットダウンします（${message.signal}）`, {
          duration: 10000,
        });
      }
    },
    [handleWebSocketMessage]
  );

  // WebSocket接続（スクリプトログとライフサイクルイベント用）
  const { status: wsStatus } = useWebSocket(sessionId, onMessage);

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
        // セッション詳細を再取得してステータスを更新
        await fetchSessionDetail(sessionId);
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
  }, [sessionId, fetchSessionDetail]);

  // 一時停止中のセッションを再開
  const handleResumeSession = useCallback(async () => {
    try {
      setProcessLoading(true);
      const response = await fetch(`/api/sessions/${sessionId}/resume`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          // セッション詳細を再取得
          await fetchSessionDetail(sessionId);
        }
        setProcessRunning(true);
        toast.success('セッションを再開しました');
      } else {
        const errorData = await response.json();
        toast.error(`セッション再開に失敗しました: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      toast.error('セッション再開に失敗しました');
    } finally {
      setProcessLoading(false);
    }
  }, [sessionId, fetchSessionDetail]);

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
              {currentSession.status === 'stopped' && (
                <button
                  onClick={handleResumeSession}
                  disabled={processLoading}
                  className="px-4 py-2 min-h-[44px] rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {processLoading ? '再開中...' : '再開'}
                </button>
              )}
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
                onClick={() => setActiveTab('claude')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'claude'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Claude
              </button>
              <button
                onClick={() => setActiveTab('shell')}
                className={`px-6 py-3 min-h-[44px] font-medium transition-colors ${
                  activeTab === 'shell'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Shell
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
           * これは特にターミナルタブのためのアーキテクチャ上の決定です。
           * XTerm.jsターミナルは一度初期化されると、DOMから削除されると状態が失われます。
           * 条件付きレンダリングではなくCSS非表示を使用することで、タブ切り替え時も
           * ターミナルの接続状態と履歴が維持されます。
           */}
          {/* Claude Tab */}
          <div className={`flex-1 overflow-hidden ${activeTab === 'claude' ? '' : 'hidden'}`}>
            {/* Claude Code Terminal */}
            <LazyClaudeTerminalPanel sessionId={sessionId} isVisible={activeTab === 'claude'} />
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

          {/* Shell Tab */}
          <div className={`flex-1 overflow-hidden ${activeTab === 'shell' ? '' : 'hidden'}`}>
            {/* Shell Terminal */}
            <LazyTerminalPanel sessionId={sessionId} />
          </div>

          {/* Scripts Tab */}
          <div className={`flex-1 overflow-hidden ${activeTab === 'scripts' ? '' : 'hidden'}`}>
            {/* Scripts */}
            <ScriptsPanel sessionId={sessionId} projectId={currentSession.project_id} />
          </div>

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
