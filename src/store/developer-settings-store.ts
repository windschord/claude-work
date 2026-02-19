import { create } from 'zustand';

/**
 * 開発ツール設定の型定義
 */
export interface DeveloperSettings {
  id: string | null;
  scope: 'GLOBAL' | 'PROJECT';
  project_id?: string;
  git_username: string | null;
  git_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  effective_settings?: {
    git_username: string | null;
    git_email: string | null;
    source: string;
  };
}

/**
 * 設定更新時の入力型
 */
export interface UpdateSettingsInput {
  git_username?: string;
  git_email?: string;
}

/**
 * SSH鍵の公開情報（秘密鍵を含まない）
 */
export interface SshKeyPublic {
  id: string;
  name: string;
  public_key: string;
  created_at: string;
}

/**
 * SSH鍵登録時の入力型
 */
export interface RegisterKeyInput {
  name: string;
  private_key: string;
  public_key?: string;
}

/**
 * 開発ツール設定ストアの状態インターフェース
 */
export interface DeveloperSettingsState {
  globalSettings: DeveloperSettings | null;
  projectSettings: Record<string, DeveloperSettings>;
  sshKeys: SshKeyPublic[];
  loading: boolean;
  error: string | null;

  fetchGlobalSettings: () => Promise<void>;
  updateGlobalSettings: (data: UpdateSettingsInput) => Promise<void>;
  fetchProjectSettings: (projectId: string) => Promise<void>;
  updateProjectSettings: (projectId: string, data: UpdateSettingsInput) => Promise<void>;
  deleteProjectSettings: (projectId: string) => Promise<void>;
  fetchSshKeys: () => Promise<void>;
  registerSshKey: (data: RegisterKeyInput) => Promise<void>;
  deleteSshKey: (id: string) => Promise<void>;
}

/**
 * 開発ツール設定ストア
 */
export const useDeveloperSettingsStore = create<DeveloperSettingsState>((set) => ({
  globalSettings: null,
  projectSettings: {},
  sshKeys: [],
  loading: false,
  error: null,

  fetchGlobalSettings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/developer-settings/global');
      if (!response.ok) {
        if (response.status === 404) {
          set({ globalSettings: null, loading: false });
          return;
        }
        throw new Error('グローバル設定の取得に失敗しました');
      }
      const data = await response.json();
      set({ globalSettings: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
    }
  },

  updateGlobalSettings: async (data: UpdateSettingsInput) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/developer-settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('グローバル設定の更新に失敗しました');
      }
      const updated = await response.json();
      set({ globalSettings: updated, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
      throw error;
    }
  },

  fetchProjectSettings: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`);
      if (!response.ok) {
        throw new Error('プロジェクト設定の取得に失敗しました');
      }
      const data = await response.json();
      set((state) => ({
        projectSettings: { ...state.projectSettings, [projectId]: data },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
    }
  },

  updateProjectSettings: async (projectId: string, data: UpdateSettingsInput) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('プロジェクト設定の更新に失敗しました');
      }
      const updated = await response.json();
      set((state) => ({
        projectSettings: { ...state.projectSettings, [projectId]: updated },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
      throw error;
    }
  },

  deleteProjectSettings: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('プロジェクト設定の削除に失敗しました');
      }
      set((state) => {
        const { [projectId]: _, ...rest } = state.projectSettings;
        return { projectSettings: rest, loading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
      throw error;
    }
  },

  fetchSshKeys: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/ssh-keys');
      if (!response.ok) {
        throw new Error('SSH鍵の取得に失敗しました');
      }
      const data = await response.json();
      set({ sshKeys: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
    }
  },

  registerSshKey: async (data: RegisterKeyInput) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/ssh-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('SSH鍵の登録に失敗しました');
      }
      const newKey = await response.json();
      set((state) => ({
        sshKeys: [...state.sshKeys, newKey],
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
      throw error;
    }
  },

  deleteSshKey: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/ssh-keys/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('SSH鍵の削除に失敗しました');
      }
      set((state) => ({
        sshKeys: state.sshKeys.filter((key) => key.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'エラーが発生しました',
        loading: false,
      });
      throw error;
    }
  },
}));
