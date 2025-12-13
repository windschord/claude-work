'use client';

import { Loader2, Play, Pause, CheckCircle, XCircle } from 'lucide-react';

interface SessionStatusIconProps {
  status: 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
}

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
      Icon: Pause,
      className: 'w-5 h-5 text-yellow-500',
      testId: 'status-icon-waiting_input',
    },
    completed: {
      Icon: CheckCircle,
      className: 'w-5 h-5 text-gray-500',
      testId: 'status-icon-completed',
    },
    error: {
      Icon: XCircle,
      className: 'w-5 h-5 text-red-500',
      testId: 'status-icon-error',
    },
  };

  const { Icon, className, testId } = iconMap[status];

  return <Icon className={className} data-testid={testId} />;
}
