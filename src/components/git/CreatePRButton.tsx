'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface CreatePRButtonProps {
  sessionId: string;
}

/**
 * PR作成ボタンコンポーネント
 *
 * セッションのブランチからGitHub PRを作成するボタン。
 * 成功時はPR URLをクリック可能なリンクとしてトースト通知で表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.sessionId - セッションID
 * @returns PR作成ボタンのJSX要素
 */
export function CreatePRButton({ sessionId }: CreatePRButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCreatePR = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/pr`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // PR URLをクリック可能なリンクとしてトースト表示
        toast.success(
          (t) => (
            <div>
              <p>PR作成しました</p>
              <a
                href={data.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                onClick={() => toast.dismiss(t.id)}
              >
                {data.pr_url}
              </a>
            </div>
          ),
          { duration: 10000 }
        );
      } else {
        toast.error(`PR作成に失敗しました: ${data.details || data.error}`);
      }
    } catch (error) {
      console.error('Failed to create PR:', error);
      toast.error('PR作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreatePR}
      disabled={isLoading}
      className="bg-purple-600 text-white rounded px-4 py-2 min-h-[44px] hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'PR作成中...' : 'PR作成'}
    </button>
  );
}
