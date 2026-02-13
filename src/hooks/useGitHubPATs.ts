'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GitHubPAT {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePATInput {
  name: string;
  token: string;
  description?: string;
}

export interface UpdatePATInput {
  name?: string;
  description?: string;
}

export interface UseGitHubPATsReturn {
  pats: GitHubPAT[];
  isLoading: boolean;
  error: string | null;
  fetchPATs: () => Promise<void>;
  createPAT: (input: CreatePATInput) => Promise<GitHubPAT>;
  updatePAT: (id: string, input: UpdatePATInput) => Promise<GitHubPAT>;
  deletePAT: (id: string) => Promise<void>;
  togglePAT: (id: string) => Promise<void>;
}

export function useGitHubPATs(): UseGitHubPATsReturn {
  const [pats, setPATs] = useState<GitHubPAT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPATs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/github-pat');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'PATの取得に失敗しました');
      }

      setPATs(data.pats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPAT = useCallback(async (input: CreatePATInput): Promise<GitHubPAT> => {
    const response = await fetch('/api/github-pat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'PATの作成に失敗しました');
    }

    await fetchPATs();
    return data;
  }, [fetchPATs]);

  const updatePAT = useCallback(async (id: string, input: UpdatePATInput): Promise<GitHubPAT> => {
    const response = await fetch(`/api/github-pat/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'PATの更新に失敗しました');
    }

    await fetchPATs();
    return data.pat;
  }, [fetchPATs]);

  const deletePAT = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/github-pat/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'PATの削除に失敗しました');
    }

    await fetchPATs();
  }, [fetchPATs]);

  const togglePAT = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/github-pat/${id}/toggle`, {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'PATの切り替えに失敗しました');
    }

    await fetchPATs();
  }, [fetchPATs]);

  useEffect(() => {
    fetchPATs();
  }, [fetchPATs]);

  return {
    pats,
    isLoading,
    error,
    fetchPATs,
    createPAT,
    updatePAT,
    deletePAT,
    togglePAT,
  };
}
