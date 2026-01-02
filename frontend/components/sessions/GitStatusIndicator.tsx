interface GitStatusIndicatorProps {
  hasUncommittedChanges: boolean;
  changedFilesCount: number;
}

export default function GitStatusIndicator({ hasUncommittedChanges, changedFilesCount }: GitStatusIndicatorProps) {
  if (!hasUncommittedChanges) {
    return (
      <div className="flex items-center gap-1 text-green-600" title="クリーン">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs">クリーン</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-yellow-600" title={`${changedFilesCount}個のファイルに変更あり`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="text-xs">{changedFilesCount}個変更</span>
    </div>
  );
}
