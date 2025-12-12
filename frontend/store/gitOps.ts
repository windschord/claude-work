import { create } from 'zustand';
import { api, Commit } from '@/lib/api';

interface GitOpsState {
  isLoading: boolean;
  error: string | null;
  conflictFiles: string[] | null;
  commits: Commit[];
  selectedCommit: string | null;
  commitDiff: string | null;
  rebaseFromMain: (sessionId: string) => Promise<boolean>;
  squashMerge: (sessionId: string, message: string) => Promise<boolean>;
  fetchCommits: (sessionId: string, limit?: number) => Promise<void>;
  fetchCommitDiff: (sessionId: string, commitHash: string) => Promise<void>;
  resetToCommit: (sessionId: string, commitHash: string) => Promise<boolean>;
  selectCommit: (commitHash: string | null) => void;
  clearConflict: () => void;
  clearError: () => void;
}

export const useGitOpsStore = create<GitOpsState>((set) => ({
  isLoading: false,
  error: null,
  conflictFiles: null,
  commits: [],
  selectedCommit: null,
  commitDiff: null,

  rebaseFromMain: async (sessionId: string) => {
    set({ isLoading: true, error: null, conflictFiles: null });
    try {
      const result = await api.rebaseFromMain(sessionId);

      if (result.success) {
        set({ isLoading: false });
        return true;
      } else {
        if (result.conflict_files && result.conflict_files.length > 0) {
          set({
            isLoading: false,
            conflictFiles: result.conflict_files,
            error: result.message
          });
        } else {
          set({ isLoading: false, error: result.message });
        }
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'rebaseに失敗しました';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  squashMerge: async (sessionId: string, message: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.squashMerge(sessionId, message);

      if (result.success) {
        set({ isLoading: false });
        return true;
      } else {
        set({ isLoading: false, error: result.message });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'マージに失敗しました';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  fetchCommits: async (sessionId: string, limit: number = 20) => {
    set({ isLoading: true, error: null });
    try {
      const commits = await api.getCommitHistory(sessionId, limit);
      set({ commits, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'コミット履歴の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  fetchCommitDiff: async (sessionId: string, commitHash: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getCommitDiff(sessionId, commitHash);
      set({ commitDiff: result.diff, selectedCommit: commitHash, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'コミットのdiff取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  resetToCommit: async (sessionId: string, commitHash: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.resetToCommit(sessionId, commitHash);

      if (result.success) {
        set({ isLoading: false });
        return true;
      } else {
        set({ isLoading: false, error: 'リセットに失敗しました' });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'リセットに失敗しました';
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  selectCommit: (commitHash: string | null) => {
    set({ selectedCommit: commitHash, commitDiff: null });
  },

  clearConflict: () => {
    set({ conflictFiles: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
