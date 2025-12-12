import { create } from 'zustand';
import { api, DiffResult } from '@/lib/api';

interface DiffState {
  diffResult: DiffResult | null;
  isLoading: boolean;
  error: string | null;
  selectedFile: string | null;
  fetchDiff: (sessionId: string) => Promise<void>;
  selectFile: (path: string | null) => void;
  clearDiff: () => void;
  clearError: () => void;
}

export const useDiffStore = create<DiffState>((set) => ({
  diffResult: null,
  isLoading: false,
  error: null,
  selectedFile: null,

  fetchDiff: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const diffResult = await api.getDiff(sessionId);
      set({ diffResult, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Diff情報の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  selectFile: (path: string | null) => {
    set({ selectedFile: path });
  },

  clearDiff: () => {
    set({ diffResult: null, selectedFile: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
