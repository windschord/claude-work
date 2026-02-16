'use client';

import { useGitHubPATs } from '@/hooks/useGitHubPATs';
import { PATList } from '@/components/github-pat/PATList';
import { BackButton } from '@/components/settings/BackButton';

export default function GitHubPATSettingsPage() {
  const {
    pats,
    isLoading,
    error,
    fetchPATs,
    createPAT,
    updatePAT,
    deletePAT,
    togglePAT,
  } = useGitHubPATs();

  return (
    <div>
      {/* 戻るボタン */}
      <div className="p-6 pb-0">
        <BackButton />
      </div>

      <PATList
        pats={pats}
        isLoading={isLoading}
        error={error}
        onCreatePAT={createPAT}
        onUpdatePAT={updatePAT}
        onDeletePAT={deletePAT}
        onTogglePAT={togglePAT}
        onRefresh={fetchPATs}
      />
    </div>
  );
}
