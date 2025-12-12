'use client';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
}

export default function ConnectionStatus({
  isConnected,
  isConnecting,
  reconnectAttempts,
}: ConnectionStatusProps) {
  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-green-700 font-medium">接続中</span>
      </div>
    );
  }

  if (isConnecting || reconnectAttempts > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-yellow-700 font-medium">
          {reconnectAttempts > 0
            ? `再接続中 (${reconnectAttempts}/5)`
            : '接続中...'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      <span className="text-sm text-red-700 font-medium">切断</span>
    </div>
  );
}
