import { SessionStatus } from '@/lib/api';

interface SessionStatusIconProps {
  status: SessionStatus;
  className?: string;
  showLabel?: boolean;
}

export default function SessionStatusIcon({ status, className = '', showLabel = true }: SessionStatusIconProps) {
  const getStatusConfig = (status: SessionStatus) => {
    switch (status) {
      case 'initializing':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          label: '初期化中',
          description: 'セッションを初期化しています',
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
          description: 'セッションが実行中です',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'waiting_input':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          label: '入力待ち',
          description: 'ユーザーの入力を待っています',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'completed':
        return {
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '完了',
          description: 'セッションが完了しました',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'error':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          label: 'エラー',
          description: 'エラーが発生しました',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${className} group relative`}
      title={config.description}
    >
      <span className={config.color}>{config.icon}</span>
      {showLabel && <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {config.description}
      </div>
    </div>
  );
}
