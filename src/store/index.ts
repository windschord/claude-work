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

  /** 認証状態を設定 */
  setAuthenticated: (isAuthenticated: boolean, token?: string) => void;
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
  /** 状態をリセット */
  reset: () => void;
}

/**
 * 初期状態
 */
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
