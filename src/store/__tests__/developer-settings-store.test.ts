import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeveloperSettingsStore } from '../developer-settings-store';
import type {
  DeveloperSettings,
  SshKeyPublic,
} from '../developer-settings-store';

// global fetchのモック
global.fetch = vi.fn();

describe('useDeveloperSettingsStore', () => {
  beforeEach(() => {
    useDeveloperSettingsStore.setState({
      globalSettings: null,
      projectSettings: {},
      sshKeys: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  // =====================
  // グローバル設定
  // =====================
  describe('fetchGlobalSettings', () => {
    const mockSettings: DeveloperSettings = {
      id: 'global-1',
      scope: 'GLOBAL',
      git_username: 'john.doe',
      git_email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    };

    it('グローバル設定を取得してストアに保存する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.globalSettings).toEqual(mockSettings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/developer-settings/global');
    });

    it('404の場合はglobalSettingsをnullに設定する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'グローバル設定が見つかりません' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.globalSettings).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('サーバーエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'サーバー内部エラー' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('グローバル設定の取得に失敗しました');
    });

    it('ネットワークエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('取得中はloadingがtrueになる', async () => {
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      vi.mocked(global.fetch).mockReturnValueOnce(fetchPromise);

      const promise = useDeveloperSettingsStore.getState().fetchGlobalSettings();

      expect(useDeveloperSettingsStore.getState().loading).toBe(true);

      resolveFetch!({
        ok: true,
        json: async () => mockSettings,
      } as Response);
      await promise;

      expect(useDeveloperSettingsStore.getState().loading).toBe(false);
    });
  });

  describe('updateGlobalSettings', () => {
    const updatedSettings: DeveloperSettings = {
      id: 'global-1',
      scope: 'GLOBAL',
      git_username: 'new.user',
      git_email: 'new@example.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-20T10:30:00Z',
    };

    it('グローバル設定を更新してストアに反映する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().updateGlobalSettings({
        git_username: 'new.user',
        git_email: 'new@example.com',
      });

      const state = useDeveloperSettingsStore.getState();
      expect(state.globalSettings).toEqual(updatedSettings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/developer-settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ git_username: 'new.user', git_email: 'new@example.com' }),
      });
    });

    it('バリデーションエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 'VALIDATION_ERROR', message: 'Git Email の形式が正しくありません' },
        }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().updateGlobalSettings({
          git_email: 'invalid',
        })
      ).rejects.toThrow('グローバル設定の更新に失敗しました');

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('グローバル設定の更新に失敗しました');
    });
  });

  // =====================
  // プロジェクト設定
  // =====================
  describe('fetchProjectSettings', () => {
    const projectId = 'project-uuid-1';
    const mockProjectSettings: DeveloperSettings = {
      id: 'proj-1',
      scope: 'PROJECT',
      project_id: projectId,
      git_username: 'work.user',
      git_email: 'work@company.com',
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      effective_settings: {
        git_username: 'work.user',
        git_email: 'work@company.com',
        source: 'project',
      },
    };

    it('プロジェクト設定を取得してストアに保存する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjectSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(mockProjectSettings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(`/api/developer-settings/project/${projectId}`);
    });

    it('プロジェクト設定が存在しない場合もレスポンスを保存する', async () => {
      const fallbackResponse = {
        id: null,
        scope: 'PROJECT',
        project_id: projectId,
        git_username: null,
        git_email: null,
        created_at: null,
        updated_at: null,
        effective_settings: {
          git_username: 'john.doe',
          git_email: 'john@example.com',
          source: 'global',
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => fallbackResponse,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(fallbackResponse);
    });

    it('複数プロジェクトの設定を個別に保存する', async () => {
      const projectId2 = 'project-uuid-2';
      const settings2 = { ...mockProjectSettings, id: 'proj-2', project_id: projectId2 };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProjectSettings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => settings2,
        } as Response);

      const store = useDeveloperSettingsStore.getState();
      await store.fetchProjectSettings(projectId);
      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId2);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(mockProjectSettings);
      expect(state.projectSettings[projectId2]).toEqual(settings2);
    });

    it('サーバーエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('プロジェクト設定の取得に失敗しました');
    });
  });

  describe('updateProjectSettings', () => {
    const projectId = 'project-uuid-1';
    const updatedProjectSettings: DeveloperSettings = {
      id: 'proj-1',
      scope: 'PROJECT',
      project_id: projectId,
      git_username: 'updated.user',
      git_email: 'updated@company.com',
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-20T10:30:00Z',
    };

    it('プロジェクト設定を更新してストアに反映する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedProjectSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().updateProjectSettings(projectId, {
        git_username: 'updated.user',
        git_email: 'updated@company.com',
      });

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(updatedProjectSettings);
      expect(state.loading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/developer-settings/project/${projectId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ git_username: 'updated.user', git_email: 'updated@company.com' }),
        }
      );
    });

    it('エラー時にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 'VALIDATION_ERROR' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().updateProjectSettings(projectId, {
          git_email: 'invalid',
        })
      ).rejects.toThrow('プロジェクト設定の更新に失敗しました');

      expect(useDeveloperSettingsStore.getState().error).toBe('プロジェクト設定の更新に失敗しました');
    });
  });

  describe('deleteProjectSettings', () => {
    const projectId = 'project-uuid-1';

    it('プロジェクト設定を削除してストアから除去する', async () => {
      // 事前にプロジェクト設定をセット
      useDeveloperSettingsStore.setState({
        projectSettings: {
          [projectId]: {
            id: 'proj-1',
            scope: 'PROJECT',
            project_id: projectId,
            git_username: 'test',
            git_email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await useDeveloperSettingsStore.getState().deleteProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toBeUndefined();
      expect(state.loading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/developer-settings/project/${projectId}`,
        { method: 'DELETE' }
      );
    });

    it('404エラーの場合にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().deleteProjectSettings(projectId)
      ).rejects.toThrow('プロジェクト設定の削除に失敗しました');

      expect(useDeveloperSettingsStore.getState().error).toBe('プロジェクト設定の削除に失敗しました');
    });
  });

  // =====================
  // SSH鍵
  // =====================
  describe('fetchSshKeys', () => {
    const mockKeys: SshKeyPublic[] = [
      {
        id: 'key-1',
        name: 'My SSH Key',
        public_key: 'ssh-rsa AAAA...',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'key-2',
        name: 'Work Key',
        public_key: 'ssh-ed25519 BBBB...',
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    it('SSH鍵一覧を取得してストアに保存する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockKeys,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchSshKeys();

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toEqual(mockKeys);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/ssh-keys');
    });

    it('エラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchSshKeys();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('SSH鍵の取得に失敗しました');
    });
  });

  describe('registerSshKey', () => {
    const newKey: SshKeyPublic = {
      id: 'key-new',
      name: 'New Key',
      public_key: 'ssh-rsa CCCC...',
      created_at: '2024-01-10T00:00:00Z',
    };

    it('SSH鍵を登録してストアに追加する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => newKey,
      } as Response);

      await useDeveloperSettingsStore.getState().registerSshKey({
        name: 'New Key',
        private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
      });

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toEqual([newKey]);
      expect(state.loading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('/api/ssh-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Key',
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
        }),
      });
    });

    it('名前重複エラーの場合にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'DUPLICATE_NAME', message: '同じ名前のSSH鍵が既に存在します' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().registerSshKey({
          name: 'Existing Key',
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
        })
      ).rejects.toThrow('SSH鍵の登録に失敗しました');

      expect(useDeveloperSettingsStore.getState().error).toBe('SSH鍵の登録に失敗しました');
    });

    it('public_keyを含めて登録できる', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => newKey,
      } as Response);

      await useDeveloperSettingsStore.getState().registerSshKey({
        name: 'New Key',
        private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
        public_key: 'ssh-rsa CCCC...',
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/ssh-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Key',
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
          public_key: 'ssh-rsa CCCC...',
        }),
      });
    });
  });

  describe('deleteSshKey', () => {
    it('SSH鍵を削除してストアから除去する', async () => {
      useDeveloperSettingsStore.setState({
        sshKeys: [
          { id: 'key-1', name: 'Key 1', public_key: 'ssh-rsa AAA', created_at: '2024-01-01T00:00:00Z' },
          { id: 'key-2', name: 'Key 2', public_key: 'ssh-rsa BBB', created_at: '2024-01-02T00:00:00Z' },
        ],
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await useDeveloperSettingsStore.getState().deleteSshKey('key-1');

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toHaveLength(1);
      expect(state.sshKeys[0].id).toBe('key-2');
      expect(state.loading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('/api/ssh-keys/key-1', {
        method: 'DELETE',
      });
    });

    it('エラーの場合にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().deleteSshKey('non-existent')
      ).rejects.toThrow('SSH鍵の削除に失敗しました');

      expect(useDeveloperSettingsStore.getState().error).toBe('SSH鍵の削除に失敗しました');
    });
  });

  // =====================
  // ローディング・エラー状態
  // =====================
  describe('状態管理', () => {
    it('エラー状態は次のアクション開始時にクリアされる', async () => {
      // まずエラーを設定
      useDeveloperSettingsStore.setState({ error: '前回のエラー' });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'global-1',
          scope: 'GLOBAL',
          git_username: 'test',
          git_email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      expect(useDeveloperSettingsStore.getState().error).toBeNull();
    });
  });
});
