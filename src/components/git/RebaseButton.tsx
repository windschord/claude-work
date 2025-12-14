'use client';

import { useAppStore } from '@/store';
import toast from 'react-hot-toast';

interface RebaseButtonProps {
  sessionId: string;
}

export function RebaseButton({ sessionId }: RebaseButtonProps) {
  const { isGitOperationLoading, rebase } = useAppStore();

  const handleRebase = async () => {
    try {
      await rebase(sessionId);
      toast.success('rebase成功');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('rebaseに失敗しました');
      }
    }
  };

  return (
    <button
      onClick={handleRebase}
      disabled={isGitOperationLoading}
      className="bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {isGitOperationLoading ? '処理中...' : 'mainから取り込み'}
    </button>
  );
}
