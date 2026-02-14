'use client';

import { useGitHubPATs } from '@/hooks/useGitHubPATs';
import { PATList } from '@/components/github-pat/PATList';

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
  );
}
