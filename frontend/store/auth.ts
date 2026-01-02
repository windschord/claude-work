import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.login(token);
      set({ isAuthenticated: true, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      set({ isAuthenticated: false, isLoading: false, error: errorMessage });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.logout();
      set({ isAuthenticated: false, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログアウトに失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const isAuth = await api.checkAuth();
      set({ isAuthenticated: isAuth, isLoading: false });
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
