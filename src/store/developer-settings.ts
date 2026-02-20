import { create } from 'zustand';

export interface DeveloperSettings {
  id: string;
  scope: 'GLOBAL' | 'PROJECT';
  project_id?: string | null;
  git_username: string | null;
  git_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSettingsResponse extends DeveloperSettings {
  effective_settings?: {
    git_username: string | null;
    git_email: string | null;
    source: string | null;
  };
}

export interface SshKey {
  id: string;
  name: string;
  public_key: string | null;
  fingerprint: string | null;
  created_at: string;
}

export interface UpdateSettingsInput {
  git_username?: string;
  git_email?: string;
}

export interface RegisterSshKeyInput {
  name: string;
  private_key: string;
  public_key?: string;
  passphrase?: string;
}

interface DeveloperSettingsState {
  globalSettings: DeveloperSettings | null;
  projectSettings: Record<string, ProjectSettingsResponse>;
  sshKeys: SshKey[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;

  fetchGlobalSettings: () => Promise<void>;
  updateGlobalSettings: (data: UpdateSettingsInput) => Promise<void>;
  fetchProjectSettings: (projectId: string) => Promise<void>;
  updateProjectSettings: (projectId: string, data: UpdateSettingsInput) => Promise<void>;
  deleteProjectSettings: (projectId: string) => Promise<void>;
  fetchSshKeys: () => Promise<void>;
  registerSshKey: (data: RegisterSshKeyInput) => Promise<void>;
  deleteSshKey: (id: string) => Promise<void>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

export const useDeveloperSettingsStore = create<DeveloperSettingsState>((set) => ({
  globalSettings: null,
  projectSettings: {},
  sshKeys: [],
  loading: false,
  error: null,
  successMessage: null,

  fetchGlobalSettings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/developer-settings/global');
      if (response.status === 404) {
        set({ globalSettings: null, loading: false });
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'グローバル設定の取得に失敗しました');
      }
      const settings = await response.json();
      set({ globalSettings: settings, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'グローバル設定の取得に失敗しました',
        loading: false,
      });
    }
  },

  updateGlobalSettings: async (data: UpdateSettingsInput) => {
    set({ loading: true, error: null, successMessage: null });
    try {
      const response = await fetch('/api/developer-settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error?.message || '設定の保存に失敗しました');
      }
      const settings = await response.json();
      set({ globalSettings: settings, loading: false, successMessage: '設定を保存しました' });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '設定の保存に失敗しました',
        loading: false,
      });
      throw err;
    }
  },

  fetchProjectSettings: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'プロジェクト設定の取得に失敗しました');
      }
      const settings = await response.json();
      set((state) => ({
        projectSettings: { ...state.projectSettings, [projectId]: settings },
        loading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'プロジェクト設定の取得に失敗しました',
        loading: false,
      });
    }
  },

  updateProjectSettings: async (projectId: string, data: UpdateSettingsInput) => {
    set({ loading: true, error: null, successMessage: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error?.message || 'プロジェクト設定の保存に失敗しました');
      }
      const settings = await response.json();
      set((state) => ({
        projectSettings: { ...state.projectSettings, [projectId]: settings },
        loading: false,
        successMessage: '設定を保存しました',
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'プロジェクト設定の保存に失敗しました',
        loading: false,
      });
      throw err;
    }
  },

  deleteProjectSettings: async (projectId: string) => {
    set({ loading: true, error: null, successMessage: null });
    try {
      const response = await fetch(`/api/developer-settings/project/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error?.message || 'プロジェクト設定の削除に失敗しました');
      }
      set((state) => {
        const newProjectSettings = { ...state.projectSettings };
        delete newProjectSettings[projectId];
        return {
          projectSettings: newProjectSettings,
          loading: false,
          successMessage: 'プロジェクト設定を削除しました',
        };
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'プロジェクト設定の削除に失敗しました',
        loading: false,
      });
      throw err;
    }
  },

  fetchSshKeys: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/ssh-keys');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'SSH鍵の取得に失敗しました');
      }
      const data = await response.json();
      set({ sshKeys: data.keys || [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'SSH鍵の取得に失敗しました',
        loading: false,
      });
    }
  },

  registerSshKey: async (data: RegisterSshKeyInput) => {
    set({ loading: true, error: null, successMessage: null });
    try {
      const response = await fetch('/api/ssh-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error?.message || 'SSH鍵の登録に失敗しました');
      }
      const resData = await response.json();
      set((state) => ({
        sshKeys: [...state.sshKeys, resData.key],
        loading: false,
        successMessage: 'SSH鍵を登録しました',
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'SSH鍵の登録に失敗しました',
        loading: false,
      });
      throw err;
    }
  },

  deleteSshKey: async (id: string) => {
    set({ loading: true, error: null, successMessage: null });
    try {
      const response = await fetch(`/api/ssh-keys/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error?.message || 'SSH鍵の削除に失敗しました');
      }
      set((state) => ({
        sshKeys: state.sshKeys.filter((key) => key.id !== id),
        loading: false,
        successMessage: 'SSH鍵を削除しました',
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'SSH鍵の削除に失敗しました',
        loading: false,
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  clearSuccessMessage: () => set({ successMessage: null }),
}));
