import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface CloneErrorMessageProps {
  errorCode?: string;
  errorMessage: string;
}

export function CloneErrorMessage({ errorCode, errorMessage }: CloneErrorMessageProps) {
  const isAuthError = errorCode === '401';
  const displayMessage = isAuthError
    ? 'GitHub認証に失敗しました。PATが有効か確認してください。'
    : errorMessage;

  return (
    <div
      role="alert"
      className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0"
          data-testid="clone-error-icon"
        />
        <div className="text-sm">
          <p className="text-red-600 dark:text-red-400">{displayMessage}</p>
          {isAuthError && (
            <Link
              href="/settings/github-pat"
              className="inline-block mt-1 text-red-700 dark:text-red-300 underline hover:text-red-800 dark:hover:text-red-200"
            >
              PAT設定画面を開く
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
