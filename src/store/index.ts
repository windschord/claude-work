import { create } from 'zustand';

// Project type definition
export interface Project {
  id: string;
  name: string;
  path: string;
  default_model: string;
  run_scripts: Array<{ name: string; command: string }>;
  session_count: number;
  created_at: string;
}

// Session type definition
export interface Session {
  id: string;
  project_id: string;
  name: string;
  status: 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
  model: string;
  worktree_path: string;
  branch_name: string;
  created_at: string;
}

// App state interface
export interface AppState {
  // Authentication
  isAuthenticated: boolean;
  token: string | null;

  // Projects
  projects: Project[];
  selectedProjectId: string | null;

  // Sessions
  sessions: Session[];
  selectedSessionId: string | null;

  // UI
  theme: 'light' | 'dark' | 'system';
  isMobile: boolean;

  // Actions
  setAuthenticated: (isAuthenticated: boolean, token?: string) => void;
  setProjects: (projects: Project[]) => void;
  setSelectedProjectId: (projectId: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setIsMobile: (isMobile: boolean) => void;
  reset: () => void;
}

// Initial state
const initialState = {
  isAuthenticated: false,
  token: null,
  projects: [],
  selectedProjectId: null,
  sessions: [],
  selectedSessionId: null,
  theme: 'system' as const,
  isMobile: false,
};

// Create Zustand store
export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAuthenticated: (isAuthenticated, token) =>
    set({ isAuthenticated, token: token || null }),

  setProjects: (projects) =>
    set({ projects }),

  setSelectedProjectId: (projectId) =>
    set({ selectedProjectId: projectId }),

  setSessions: (sessions) =>
    set({ sessions }),

  setSelectedSessionId: (sessionId) =>
    set({ selectedSessionId: sessionId }),

  setTheme: (theme) =>
    set({ theme }),

  setIsMobile: (isMobile) =>
    set({ isMobile }),

  reset: () =>
    set(initialState),
}));
