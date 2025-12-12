import { create } from 'zustand';
import { api, Project } from '@/lib/api';

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  selectedProjectId: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (path: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string) => void;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  isLoading: false,
  error: null,
  selectedProjectId: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await api.getProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロジェクト一覧の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  addProject: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const newProject = await api.createProject(path);
      set((state) => ({
        projects: [...state.projects, newProject],
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロジェクトの作成に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        isLoading: false,
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロジェクトの削除に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  selectProject: (id: string) => set({ selectedProjectId: id }),

  clearError: () => set({ error: null }),
}));
