'use client';

import { useState } from 'react';
import { useGitOpsStore } from '@/store/gitOps';

interface RebaseButtonProps {
  sessionId: string;
  onSuccess?: () => void;
}

export default function RebaseButton({ sessionId, onSuccess }: RebaseButtonProps) {
  const { isLoading, rebaseFromMain } = useGitOpsStore();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRebase = async () => {
    setSuccessMessage(null);
    const success = await rebaseFromMain(sessionId);

    if (success) {
      setSuccessMessage('mainブランチからの取り込みが完了しました');
      setTimeout(() => setSuccessMessage(null), 3000);

      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRebase}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>取り込み中...</span>
          </>
        ) : (
          'mainから取り込み'
        )}
      </button>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2 text-sm text-green-800">
          {successMessage}
        </div>
      )}
    </div>
  );
}
