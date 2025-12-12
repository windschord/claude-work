import { create } from 'zustand';
import { api, PromptHistory } from '@/lib/api';

interface PromptHistoryState {
  history: PromptHistory[];
  isLoading: boolean;
  error: string | null;
  fetchHistory: (projectId: string) => Promise<void>;
  saveToHistory: (projectId: string, promptText: string) => Promise<void>;
  deleteFromHistory: (projectId: string, historyId: number) => Promise<void>;
  clearError: () => void;
}

export const usePromptHistoryStore = create<PromptHistoryState>((set) => ({
  history: [],
  isLoading: false,
  error: null,

  fetchHistory: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const history = await api.getPromptHistory(projectId);
      set({ history, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロンプト履歴の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  saveToHistory: async (projectId: string, promptText: string) => {
    set({ error: null });
    try {
      const newHistory = await api.savePromptHistory(projectId, promptText);
      set((state) => ({
        history: [newHistory, ...state.history].slice(0, 20),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロンプト履歴の保存に失敗しました';
      set({ error: errorMessage });
      throw error;
    }
  },

  deleteFromHistory: async (projectId: string, historyId: number) => {
    set({ error: null });
    try {
      await api.deletePromptHistory(projectId, historyId);
      set((state) => ({
        history: state.history.filter((h) => h.id !== historyId),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロンプト履歴の削除に失敗しました';
      set({ error: errorMessage });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
