import { create } from 'zustand';

/**
 * ランスクリプトの型定義
 */
export interface RunScript {
  /** スクリプトID */
  id: string;
  /** プロジェクトID */
  project_id: string;
  /** スクリプト名 */
  name: string;
  /** 説明（オプション） */
  description: string | null;
  /** 実行コマンド */
  command: string;
  /** 作成日時 */
  created_at: string;
  /** 更新日時 */
  updated_at: string;
}

/**
 * スクリプト追加時のデータ型定義
 */
export interface AddScriptData {
  /** スクリプト名 */
  name: string;
  /** 説明（オプション、nullで説明をクリア可能） */
  description?: string | null;
  /** 実行コマンド */
  command: string;
}

/**
 * スクリプト更新時のデータ型定義
 */
export interface UpdateScriptData {
  /** スクリプト名 */
  name?: string;
  /** 説明（nullで説明をクリア可能） */
  description?: string | null;
  /** 実行コマンド */
  command?: string;
}

/**
 * ランスクリプト状態管理インターフェース
 *
 * Zustandを使用したランスクリプトの状態管理の型定義です。
 * スクリプトの取得、追加、更新、削除のアクションを含みます。
 */
export interface RunScriptState {
  /** スクリプト一覧 */
  scripts: RunScript[];
  /** ローディング状態 */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;

  /**
   * プロジェクトのスクリプト一覧を取得
   * @param projectId プロジェクトID
   */
  fetchScripts: (projectId: string) => Promise<void>;

  /**
   * スクリプトを追加
   * @param projectId プロジェクトID
   * @param data スクリプトデータ
   */
  addScript: (projectId: string, data: AddScriptData) => Promise<void>;

  /**
   * スクリプトを更新
   * @param projectId プロジェクトID
   * @param scriptId スクリプトID
   * @param data 更新データ
   */
  updateScript: (
    projectId: string,
    scriptId: string,
    data: UpdateScriptData
  ) => Promise<void>;

  /**
   * スクリプトを削除
   * @param projectId プロジェクトID
   * @param scriptId スクリプトID
   */
  deleteScript: (projectId: string, scriptId: string) => Promise<void>;
}

/**
 * ランスクリプト状態管理ストア
 */
export const useRunScriptStore = create<RunScriptState>((set) => ({
  scripts: [],
  isLoading: false,
  error: null,

  fetchScripts: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`);
      if (!response.ok) {
        throw new Error('スクリプトの取得に失敗しました');
      }
      const data = await response.json();
      set({ scripts: data.scripts || [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        isLoading: false,
      });
    }
  },

  addScript: async (projectId: string, data: AddScriptData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('ランスクリプトの追加に失敗しました');
      }
      const newScript = await response.json();
      set((state) => ({
        scripts: [...state.scripts, newScript],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        isLoading: false,
      });
      throw error;
    }
  },

  updateScript: async (
    projectId: string,
    scriptId: string,
    data: UpdateScriptData
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `/api/projects/${projectId}/scripts/${scriptId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        throw new Error('スクリプトの更新に失敗しました');
      }
      const updatedScript = await response.json();
      set((state) => ({
        scripts: state.scripts.map((script) =>
          script.id === scriptId ? updatedScript : script
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteScript: async (projectId: string, scriptId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `/api/projects/${projectId}/scripts/${scriptId}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        throw new Error('スクリプトの削除に失敗しました');
      }
      set((state) => ({
        scripts: state.scripts.filter((script) => script.id !== scriptId),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        isLoading: false,
      });
      throw error;
    }
  },
}));
