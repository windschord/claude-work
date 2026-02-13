'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GitHubPATSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UseGitHubPATsReturn {
  pats: GitHubPATSummary[];
  isLoading: boolean;
  error: string | null;
  fetchPATs: () => Promise<void>;
}

/**
 * GitHub PAT一覧を取得するフック
 */
export function useGitHubPATs(): UseGitHubPATsReturn {
  const [pats, setPATs] = useState<GitHubPATSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPATs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/github-pat');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'GitHub PATの取得に失敗しました');
      }

      setPATs(data.pats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'GitHub PATの取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPATs();
  }, [fetchPATs]);

  return {
    pats,
    isLoading,
    error,
    fetchPATs,
  };
}
