import { SessionStatus } from '@/lib/api';

interface SessionStatusIconProps {
  status: SessionStatus;
  className?: string;
}

export default function SessionStatusIcon({ status, className = '' }: SessionStatusIconProps) {
  const getStatusConfig = (status: SessionStatus) => {
    switch (status) {
      case 'initializing':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          label: '初期化中',
          icon: (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ),
        };
      case 'running':
        return {
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          label: '実行中',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="4" />
            </svg>
          ),
        };
      case 'waiting_input':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          label: '入力待ち',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'completed':
        return {
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '完了',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'error':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          label: 'エラー',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ),
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${className}`}>
      <span className={config.color}>{config.icon}</span>
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}
