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
  /** 更新日時（オプショナル：既存データとの互換性のため） */
  updated_at?: string;
}

/**
 * セッション作成時のデータ型定義
 */
export interface CreateSessionData {
  /** セッション名 */
  name: string;
  /** プロンプト */
  prompt: string;
  /** 使用するClaudeモデル（デフォルト: 'auto'） */
  model?: string;
}

/**
 * 一括セッション作成時のデータ型定義
 */
export interface CreateBulkSessionsData {
  /** セッション名（各セッションに-1, -2などのサフィックスが付与される） */
  name: string;
  /** プロンプト */
  prompt: string;
  /** 使用するClaudeモデル（デフォルト: 'auto'） */
  model?: string;
  /** 作成するセッション数（2-10） */
  count: number;
}

/**
 * メッセージの型定義
 */
export interface Message {
  /** メッセージID */
  id: string;
  /** 所属するセッションのID */
  session_id: string;
  /** メッセージの役割 */
  role: 'user' | 'assistant';
  /** メッセージ内容 */
  content: string;
  /** サブエージェント情報（JSON形式） */
  sub_agents: string | null;
  /** 作成日時 */
  created_at: string;
}

/**
 * 権限リクエストの型定義
 */
export interface PermissionRequest {
  /** 権限リクエストID */
  id: string;
  /** 権限タイプ */
  type: string;
  /** 説明 */
  description: string;
  /** 詳細 */
  details: string;
}

/**
 * Diffファイルの型定義
 */
export interface DiffFile {
  /** ファイルパス */
  path: string;
  /** ファイルのステータス */
  status: 'added' | 'modified' | 'deleted';
  /** 追加行数 */
  additions: number;
  /** 削除行数 */
  deletions: number;
  /** 変更前の内容 */
  oldContent: string;
  /** 変更後の内容 */
  newContent: string;
}

/**
 * Diffデータの型定義
 */
export interface DiffData {
  /** ファイルのリスト */
  files: DiffFile[];
  /** 合計追加行数 */
  totalAdditions: number;
  /** 合計削除行数 */
  totalDeletions: number;
}

/**
 * プロンプト履歴の型定義
 */
export interface Prompt {
  /** プロンプトID */
  id: string;
  /** プロンプト内容 */
  content: string;
  /** 使用回数 */
  used_count: number;
  /** 最終使用日時 */
  last_used_at: string;
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

  /** 現在表示中のセッション詳細 */
  currentSession: Session | null;
  /** メッセージ一覧 */
  messages: Message[];
  /** 権限リクエスト */
  permissionRequest: PermissionRequest | null;

  /** Diff情報 */
  diff: DiffData | null;
  /** 選択中のファイル */
  selectedFile: string | null;

  /** Git操作のローディング状態 */
  isGitOperationLoading: boolean;
  /** コンフリクトファイル一覧 */
  conflictFiles: string[] | null;

  /** エラーメッセージ */
  error: string | null;

  /** プロンプト履歴 */
  prompts: Prompt[];
  /** プロンプト取得中かどうか */
  isLoading: boolean;

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
  /** プロジェクトを追加 */
  addProject: (path: string) => Promise<void>;
  /** プロジェクトを更新 */
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  /** プロジェクトを削除 */
  deleteProject: (id: string) => Promise<void>;
  /** 選択中のプロジェクトIDを設定 */
  setSelectedProjectId: (projectId: string | null) => void;
  /** セッション一覧を取得 */
  fetchSessions: (projectId: string) => Promise<void>;
  /** セッションを作成 */
  createSession: (projectId: string, data: CreateSessionData) => Promise<void>;
  /** 一括セッションを作成 */
  createBulkSessions: (projectId: string, data: CreateBulkSessionsData) => Promise<void>;
  /** セッション一覧を設定 */
  setSessions: (sessions: Session[]) => void;
  /** 選択中のセッションIDを設定 */
  setSelectedSessionId: (sessionId: string | null) => void;
  /** セッション詳細を取得 */
  fetchSessionDetail: (sessionId: string) => Promise<void>;
  /** メッセージを送信 */
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  /** 権限リクエストを承認 */
  approvePermission: (sessionId: string, permissionId: string, action: 'approve' | 'reject') => Promise<void>;
  /** セッションを停止 */
  stopSession: (sessionId: string) => Promise<void>;
  /** Diffを取得 */
  fetchDiff: (sessionId: string) => Promise<void>;
  /** ファイルを選択 */
  selectFile: (path: string | null) => void;
  /** rebase実行 */
  rebase: (sessionId: string) => Promise<void>;
  /** merge実行 */
  merge: (sessionId: string, commitMessage: string) => Promise<void>;
  /** セッションを削除 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** WebSocketメッセージを処理 */
  handleWebSocketMessage: (message: import('@/types/websocket').ServerMessage) => void;
  /** プロンプト履歴を取得 */
  fetchPrompts: () => Promise<void>;
  /** プロンプトを削除 */
  deletePrompt: (promptId: string) => Promise<void>;
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
  currentSession: null,
  messages: [],
  permissionRequest: null,
  diff: null,
  selectedFile: null,
  isGitOperationLoading: false,
  conflictFiles: null,
  error: null,
  prompts: [],
  isLoading: false,
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

  addProject: async (path: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400) {
          if (errorData.error?.includes('Git') || errorData.error?.includes('リポジトリ')) {
            throw new Error('指定されたパスはGitリポジトリではありません');
          }
          throw new Error('有効なパスを入力してください');
        }

        if (response.status === 403) {
          throw new Error('指定されたパスは許可されていません');
        }

        if (response.status === 409) {
          throw new Error('このパスは既に登録されています');
        }

        if (response.status === 500) {
          throw new Error('プロジェクトの追加に失敗しました');
        }

        throw new Error(errorData.error || 'プロジェクトの追加に失敗しました');
      }

      const data = await response.json();

      // データ検証: projectとproject.idが存在することを確認
      if (!data.project || !data.project.id) {
        throw new Error('プロジェクトの追加に失敗しました');
      }

      set((state) => ({
        projects: [...state.projects, data.project],
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('プロジェクトの追加に失敗しました');
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('プロジェクトが見つかりません');
        }
        throw new Error('プロジェクトの更新に失敗しました');
      }

      const responseData = await response.json();
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? responseData.project : p
        ),
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('プロジェクトの更新に失敗しました');
    }
  },

  deleteProject: async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('プロジェクトが見つかりません');
        }
        throw new Error('プロジェクトの削除に失敗しました');
      }

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('プロジェクトの削除に失敗しました');
    }
  },

  fetchSessions: async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`);

      if (!response.ok) {
        throw new Error('セッション一覧の取得に失敗しました');
      }

      const data = await response.json();
      set({ sessions: data.sessions || [] });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッション一覧の取得に失敗しました');
    }
  },

  createSession: async (projectId: string, data: CreateSessionData) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('セッションの作成に失敗しました');
        }
        if (response.status === 500) {
          throw new Error('セッションの作成に失敗しました');
        }
        throw new Error('セッションの作成に失敗しました');
      }

      const responseData = await response.json();
      set((state) => ({
        sessions: [...state.sessions, responseData.session],
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッションの作成に失敗しました');
    }
  },

  createBulkSessions: async (projectId: string, data: CreateBulkSessionsData) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('セッションの作成に失敗しました');
        }
        if (response.status === 500) {
          throw new Error('セッションの作成に失敗しました');
        }
        throw new Error('セッションの作成に失敗しました');
      }

      // セッション一覧を再取得
      const get = useAppStore.getState();
      await get.fetchSessions(projectId);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッションの作成に失敗しました');
    }
  },

  fetchSessionDetail: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('セッションが見つかりません');
        }
        throw new Error('セッション詳細の取得に失敗しました');
      }

      const data = await response.json();

      // Fetch messages for this session
      const messagesResponse = await fetch(`/api/sessions/${sessionId}/messages`);
      let messages = [];
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        messages = messagesData.messages || [];
      }

      set({ currentSession: data.session, messages });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッション詳細の取得に失敗しました');
    }
  },

  sendMessage: async (sessionId: string, content: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('メッセージの送信に失敗しました');
      }

      const data = await response.json();
      set((state) => ({
        messages: [...state.messages, data.message],
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('メッセージの送信に失敗しました');
    }
  },

  approvePermission: async (sessionId: string, permissionId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permission_id: permissionId, action }),
      });

      if (!response.ok) {
        throw new Error('権限リクエストの処理に失敗しました');
      }

      // Clear permission request after handling
      set({ permissionRequest: null });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('権限リクエストの処理に失敗しました');
    }
  },

  stopSession: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('セッションの停止に失敗しました');
      }

      const data = await response.json();
      set({ currentSession: data.session });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッションの停止に失敗しました');
    }
  },

  fetchDiff: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/diff`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('セッションが見つかりません');
        }
        throw new Error('差分の取得に失敗しました');
      }

      const data = await response.json();
      set({ diff: data.diff });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('差分の取得に失敗しました');
    }
  },

  selectFile: (path: string | null) =>
    set({ selectedFile: path }),

  rebase: async (sessionId: string) => {
    try {
      set({ isGitOperationLoading: true, conflictFiles: null });

      const response = await fetch(`/api/sessions/${sessionId}/rebase`, {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json();
          set({ conflictFiles: data.conflicts || [] });
          throw new Error('コンフリクトが発生しました');
        }
        throw new Error('rebaseに失敗しました');
      }

      set({ conflictFiles: null });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('rebaseに失敗しました');
    } finally {
      set({ isGitOperationLoading: false });
    }
  },

  merge: async (sessionId: string, commitMessage: string) => {
    try {
      set({ isGitOperationLoading: true, conflictFiles: null });

      const response = await fetch(`/api/sessions/${sessionId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commitMessage }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json();
          set({ conflictFiles: data.conflicts || [] });
          throw new Error('コンフリクトが発生しました');
        }
        if (response.status === 400) {
          throw new Error('コミットメッセージが無効です');
        }
        throw new Error('マージに失敗しました');
      }

      set({ conflictFiles: null });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('マージに失敗しました');
    } finally {
      set({ isGitOperationLoading: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('セッションが見つかりません');
        }
        throw new Error('セッションの削除に失敗しました');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          throw new Error('ネットワークエラーが発生しました');
        }
        throw error;
      }
      throw new Error('セッションの削除に失敗しました');
    }
  },

  handleWebSocketMessage: (message) => {
    const MAX_MESSAGES = 1000;

    switch (message.type) {
      case 'output':
        set((state) => {
          const newMessage: Message = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            session_id: state.currentSession?.id || state.selectedSessionId || '',
            role: 'assistant',
            content: message.content,
            sub_agents: message.subAgent ? JSON.stringify(message.subAgent) : null,
            created_at: new Date().toISOString(),
          };

          const updatedMessages = [...state.messages, newMessage];

          // メッセージが1000件を超えたら古いメッセージを削除
          if (updatedMessages.length > MAX_MESSAGES) {
            return {
              messages: updatedMessages.slice(updatedMessages.length - MAX_MESSAGES),
            };
          }

          return { messages: updatedMessages };
        });
        break;

      case 'permission_request':
        set({
          permissionRequest: {
            id: message.permission.requestId,
            type: message.permission.action,
            description: message.permission.action,
            details: message.permission.details,
          },
        });
        break;

      case 'status_change':
        set((state) => ({
          // セッション一覧のステータスを更新
          sessions: state.sessions.map((s) =>
            s.id === state.selectedSessionId
              ? { ...s, status: message.status }
              : s
          ),
          // currentSessionのステータスも更新
          currentSession: state.currentSession
            ? { ...state.currentSession, status: message.status }
            : null,
        }));
        break;

      case 'error':
        set({ error: message.content });
        break;
    }
  },

  reset: () =>
    set(initialState),
}));
