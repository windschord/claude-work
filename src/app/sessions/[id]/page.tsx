'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
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
import { Toaster } from 'react-hot-toast';

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
    sendMessage,
    approvePermission,
    stopSession,
    deleteSession,
    checkAuth,
  } = useAppStore();

  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'diff'>('chat');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [isDeleteWorktreeDialogOpen, setIsDeleteWorktreeDialogOpen] = useState(false);

  // Initial fetch and polling setup
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        await fetchSessionDetail(sessionId);
      } catch (error) {
        console.error('Failed to fetch session detail:', error);
      }
    };

    // Initial fetch
    fetchData();

    // Setup polling if session is running or waiting for input
    const setupPolling = () => {
      if (currentSession?.status === 'running' || currentSession?.status === 'waiting_input') {
        intervalId = setInterval(fetchData, 3000);
      } else if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    setupPolling();

    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sessionId, fetchSessionDetail, currentSession?.status]);

  // Show permission dialog when permission request is available
  useEffect(() => {
    if (permissionRequest) {
      setIsPermissionDialogOpen(true);
    }
  }, [permissionRequest]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
        }
      };
      fetchDiffData();
    }
  }, [activeTab, sessionId, fetchDiff]);

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(sessionId, content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleApprove = async (permissionId: string) => {
    try {
      await approvePermission(sessionId, permissionId, 'approve');
    } catch (error) {
      console.error('Failed to approve permission:', error);
    }
  };

  const handleReject = async (permissionId: string) => {
    try {
      await approvePermission(sessionId, permissionId, 'reject');
    } catch (error) {
      console.error('Failed to reject permission:', error);
    }
  };

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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ステータス: {currentSession.status} | モデル: {currentSession.model}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                戻る
              </button>
              {(currentSession.status === 'running' || currentSession.status === 'waiting_input') && (
                <button
                  onClick={handleStopSession}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
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
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                対話
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'diff'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Diff
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages */}
              <MessageList messages={messages} />

              {/* Input Form */}
              <InputForm
                onSubmit={handleSendMessage}
                disabled={currentSession.status !== 'running' && currentSession.status !== 'waiting_input'}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Git Operations Buttons */}
              <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex gap-3">
                <RebaseButton sessionId={sessionId} />
                <button
                  onClick={() => setIsMergeModalOpen(true)}
                  className="bg-green-500 text-white rounded px-4 py-2 hover:bg-green-600 transition-colors"
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
          )}

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
