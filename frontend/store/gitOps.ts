import { create } from 'zustand';
import { api } from '@/lib/api';

interface GitOpsState {
  isLoading: boolean;
  error: string | null;
  conflictFiles: string[] | null;
  rebaseFromMain: (sessionId: string) => Promise<boolean>;
  squashMerge: (sessionId: string, message: string) => Promise<boolean>;
  clearConflict: () => void;
  clearError: () => void;
}

export const useGitOpsStore = create<GitOpsState>((set) => ({
  isLoading: false,
  error: null,
  conflictFiles: null,

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

  clearConflict: () => {
    set({ conflictFiles: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
