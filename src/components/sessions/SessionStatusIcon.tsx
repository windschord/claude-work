'use client';

import { Loader2, Play, MessageCircle, CheckCircle, XCircle, StopCircle } from 'lucide-react';

interface SessionStatusIconProps {
  status: 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error' | 'stopped';
}

/**
 * セッションステータスアイコンコンポーネント
 *
 * セッションの現在の状態を視覚的に表示するアイコンを提供します。
 * 各ステータスに応じた適切なアイコンと色を表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.status - セッションの現在のステータス
 * @returns ステータスアイコンのJSX要素
 */
export function SessionStatusIcon({ status }: SessionStatusIconProps) {
  const iconMap = {
    initializing: {
      Icon: Loader2,
      className: 'w-5 h-5 text-blue-500 animate-spin',
      testId: 'status-icon-initializing',
    },
    running: {
      Icon: Play,
      className: 'w-5 h-5 text-green-500',
      testId: 'status-icon-running',
    },
    waiting_input: {
      Icon: MessageCircle,
      className: 'w-5 h-5 text-yellow-500',
      testId: 'status-icon-waiting_input',
    },
    completed: {
      Icon: CheckCircle,
      className: 'w-5 h-5 text-green-500',
      testId: 'status-icon-completed',
    },
    error: {
      Icon: XCircle,
      className: 'w-5 h-5 text-red-500',
      testId: 'status-icon-error',
    },
    stopped: {
      Icon: StopCircle,
      className: 'w-5 h-5 text-gray-500',
      testId: 'status-icon-stopped',
    },
  };

  const { Icon, className, testId } = iconMap[status];

  return <Icon className={className} data-testid={testId} />;
}
