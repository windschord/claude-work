import { create } from 'zustand';
import { api, RunScript } from '@/lib/api';

interface RunScriptsState {
  runScripts: Record<string, RunScript[]>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchRunScripts: (projectId: string) => Promise<void>;
  createRunScript: (projectId: string, name: string, command: string) => Promise<void>;
  updateRunScript: (projectId: string, scriptId: number, name: string, command: string) => Promise<void>;
  deleteRunScript: (projectId: string, scriptId: number) => Promise<void>;
  clearError: () => void;
}

export const useRunScriptsStore = create<RunScriptsState>((set, get) => ({
  runScripts: {},
  loading: false,
  error: null,

  fetchRunScripts: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const scripts = await api.getRunScripts(projectId);
      set((state) => ({
        runScripts: {
          ...state.runScripts,
          [projectId]: scripts,
        },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ランスクリプトの取得に失敗しました',
        loading: false,
      });
    }
  },

  createRunScript: async (projectId: string, name: string, command: string) => {
    set({ loading: true, error: null });
    try {
      const newScript = await api.createRunScript(projectId, name, command);
      set((state) => ({
        runScripts: {
          ...state.runScripts,
          [projectId]: [...(state.runScripts[projectId] || []), newScript],
        },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ランスクリプトの作成に失敗しました',
        loading: false,
      });
      throw error;
    }
  },

  updateRunScript: async (projectId: string, scriptId: number, name: string, command: string) => {
    set({ loading: true, error: null });
    try {
      const updatedScript = await api.updateRunScript(projectId, scriptId, name, command);
      set((state) => ({
        runScripts: {
          ...state.runScripts,
          [projectId]: (state.runScripts[projectId] || []).map((script) =>
            script.id === scriptId ? updatedScript : script
          ),
        },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ランスクリプトの更新に失敗しました',
        loading: false,
      });
      throw error;
    }
  },

  deleteRunScript: async (projectId: string, scriptId: number) => {
    set({ loading: true, error: null });
    try {
      await api.deleteRunScript(projectId, scriptId);
      set((state) => ({
        runScripts: {
          ...state.runScripts,
          [projectId]: (state.runScripts[projectId] || []).filter((script) => script.id !== scriptId),
        },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ランスクリプトの削除に失敗しました',
        loading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
