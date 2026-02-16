'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onBeforeNavigate?: () => boolean;
}

export function BackButton({ onBeforeNavigate }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    // 戻る前のチェック（未保存変更の確認など）
    if (onBeforeNavigate && !onBeforeNavigate()) {
      return; // ナビゲーション中断
    }
    router.push('/settings');
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      設定に戻る
    </button>
  );
}
