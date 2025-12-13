import { create } from 'zustand';

/**
 * プロジェクトの型定義
 */
export interface Project {
  /** プロジェクトID */
  id: string;
  /** プロジェクト名 */
  name: string;
  /** Gitリポジトリのパス */
  path: string;
  /** デフォルトのClaudeモデル */
  default_model: string;
  /** 実行スクリプトの配列 */
  run_scripts: Array<{ name: string; command: string }>;
  /** セッション数 */
  session_count: number;
  /** 作成日時 */
  created_at: string;
}

/**
 * セッションの型定義
 */
export interface Session {
  /** セッションID */
  id: string;
  /** 所属するプロジェクトのID */
  project_id: string;
  /** セッション名 */
  name: string;
  /** セッションの状態 */
  status: 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
  /** 使用しているClaudeモデル */
  model: string;
  /** Git worktreeのパス */
  worktree_path: string;
  /** Gitブランチ名 */
  branch_name: string;
  /** 作成日時 */
  created_at: string;
}

/**
 * アプリケーション全体の状態管理インターフェース
 *
 * Zustandを使用したグローバルステート管理の型定義です。
 * 認証、プロジェクト、セッション、UIの状態とアクションを含みます。
 */
export interface AppState {
  /** 認証状態 */
  isAuthenticated: boolean;
  /** 認証トークン */
  token: string | null;
  /** セッションID */
  sessionId: string | null;
  /** セッション有効期限 */
  expiresAt: string | null;

  /** プロジェクト一覧 */
  projects: Project[];
  /** 選択中のプロジェクトID */
  selectedProjectId: string | null;

  /** セッション一覧 */
  sessions: Session[];
  /** 選択中のセッションID */
  selectedSessionId: string | null;

  /** テーマ設定 */
  theme: 'light' | 'dark' | 'system';
  /** モバイル表示かどうか */
  isMobile: boolean;
  /** サイドバーが開いているか（モバイル時） */
  isSidebarOpen: boolean;

  /** 認証状態を設定 */
  setAuthenticated: (isAuthenticated: boolean, token?: string) => void;
  /** ログイン処理 */
  login: (token: string) => Promise<void>;
  /** ログアウト処理 */
  logout: () => Promise<void>;
  /** 認証状態確認 */
  checkAuth: () => Promise<void>;
  /** プロジェクト一覧を取得 */
  fetchProjects: () => Promise<void>;
  /** プロジェクト一覧を設定 */
  setProjects: (projects: Project[]) => void;
  /** 選択中のプロジェクトIDを設定 */
  setSelectedProjectId: (projectId: string | null) => void;
  /** セッション一覧を設定 */
  setSessions: (sessions: Session[]) => void;
  /** 選択中のセッションIDを設定 */
  setSelectedSessionId: (sessionId: string | null) => void;
  /** テーマを設定 */
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  /** モバイル表示フラグを設定 */
  setIsMobile: (isMobile: boolean) => void;
  /** サイドバーの開閉を設定 */
  setIsSidebarOpen: (isOpen: boolean) => void;
  /** 状態をリセット */
  reset: () => void;
}

/**
 * 初期状態
 */
const initialState = {
  isAuthenticated: false,
  token: null,
  sessionId: null,
  expiresAt: null,
  projects: [],
  selectedProjectId: null,
  sessions: [],
  selectedSessionId: null,
  theme: 'system' as const,
  isMobile: false,
  isSidebarOpen: false,
};

/**
 * アプリケーション状態管理用のZustandストア
 *
 * グローバルな状態管理を提供します。
 * Reactコンポーネントから`useAppStore()`フックで利用できます。
 *
 * @example
 * ```typescript
 * import { useAppStore } from '@/store';
 *
 * function MyComponent() {
 *   const { isAuthenticated, setAuthenticated } = useAppStore();
 *   // ...
 * }
 * ```
 */
export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAuthenticated: (isAuthenticated, token) =>
    set({ isAuthenticated, token: token || null }),

  login: async (token: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('トークンが無効です');
        }
        if (response.status === 500) {
          throw new Error('サーバーエラーが発生しました');
        }
        throw new Error('ログインに失敗しました');
      }

      const data = await response.json();
      set({
        isAuthenticated: true,
        sessionId: data.session_id,
        expiresAt: data.expires_at,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('ログインに失敗しました');
    }
  },

  logout: async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('ログアウトに失敗しました');
      }

      set({
        isAuthenticated: false,
        sessionId: null,
        expiresAt: null,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('ログアウトに失敗しました');
    }
  },

  checkAuth: async () => {
    try {
      const response = await fetch('/api/auth/session');

      if (!response.ok) {
        set({
          isAuthenticated: false,
          sessionId: null,
          expiresAt: null,
        });
        return;
      }

      const data = await response.json();
      if (data.authenticated) {
        set({
          isAuthenticated: true,
          sessionId: data.session_id,
          expiresAt: data.expires_at,
        });
      } else {
        set({
          isAuthenticated: false,
          sessionId: null,
          expiresAt: null,
        });
      }
    } catch {
      // セッションチェックエラーは未認証として扱う
      set({
        isAuthenticated: false,
        sessionId: null,
        expiresAt: null,
      });
    }
  },

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

  setIsSidebarOpen: (isOpen) =>
    set({ isSidebarOpen: isOpen }),

  fetchProjects: async () => {
    try {
      const response = await fetch('/api/projects');

      if (!response.ok) {
        throw new Error('プロジェクト一覧の取得に失敗しました');
      }

      const data = await response.json();
      set({ projects: data.projects || [] });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('プロジェクト一覧の取得に失敗しました');
    }
  },

  reset: () =>
    set(initialState),
}));
