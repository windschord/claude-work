import { create } from 'zustand';
import { api, Session } from '@/lib/api';

interface SessionsState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, name: string, initialPrompt?: string, count?: number) => Promise<Session[]>;
  stopSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await api.getSessions(projectId);
      set({ sessions, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッション一覧の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  createSession: async (projectId: string, name: string, initialPrompt?: string, count?: number) => {
    set({ isLoading: true, error: null });
    try {
      const newSessions = await api.createSession(projectId, name, initialPrompt, count);
      set((state) => ({
        sessions: [...state.sessions, ...newSessions],
        isLoading: false,
      }));
      return newSessions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの作成に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  stopSession: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.stopSession(id);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, status: 'completed' as const } : s
        ),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの停止に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  deleteSession: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの削除に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
