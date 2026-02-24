import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDeveloperSettingsStore } from '../developer-settings';
import type {
  DeveloperSettings,
  ProjectSettingsResponse,
  SshKey,
} from '../developer-settings';

const fetchMock = vi.fn();

describe('useDeveloperSettingsStore (developer-settings)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useDeveloperSettingsStore.setState({
      globalSettings: null,
      projectSettings: {},
      sshKeys: [],
      loading: false,
      error: null,
      successMessage: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.globalSettings).toEqual(mockSettings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith('/api/developer-settings/global');
    });

    it('404の場合はglobalSettingsをnullに設定しエラーにしない', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.globalSettings).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('サーバーエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).not.toBeNull();
    });

    it('ネットワークエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(fetchMock).mockRejectedValueOnce(new Error('Network error'));

      await useDeveloperSettingsStore.getState().fetchGlobalSettings();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
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

    it('グローバル設定を更新してsuccessMessageを設定する', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
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
      expect(state.successMessage).toBe('設定を保存しました');
      expect(fetchMock).toHaveBeenCalledWith('/api/developer-settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ git_username: 'new.user', git_email: 'new@example.com' }),
      });
    });

    it('エラー時にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Validation error' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().updateGlobalSettings({ git_email: 'invalid' })
      ).rejects.toThrow();

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).not.toBeNull();
    });
  });

  // =====================
  // プロジェクト設定
  // =====================
  describe('fetchProjectSettings', () => {
    const projectId = 'project-uuid-1';

    it('ProjectSettingsResponseをストアに保存する', async () => {
      const mockProjectSettings: ProjectSettingsResponse = {
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
          source: {
            git_username: 'project',
            git_email: 'project',
          },
        },
      };

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjectSettings,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(mockProjectSettings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('effective_settings.source が項目別のオブジェクト形式であることを確認する', async () => {
      const mockWithGlobalSource: ProjectSettingsResponse = {
        id: null,
        scope: 'PROJECT',
        project_id: projectId,
        git_username: null,
        git_email: null,
        created_at: null,
        updated_at: null,
        effective_settings: {
          git_username: 'global.user',
          git_email: 'global@example.com',
          source: {
            git_username: 'global',
            git_email: 'global',
          },
        },
      };

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWithGlobalSource,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      const stored = state.projectSettings[projectId];
      expect(stored.effective_settings?.source).toEqual({
        git_username: 'global',
        git_email: 'global',
      });
    });

    it('git_usernameのみprojectで他はglobalというミックスソースをサポートする', async () => {
      const mockMixedSource: ProjectSettingsResponse = {
        id: 'proj-1',
        scope: 'PROJECT',
        project_id: projectId,
        git_username: 'project.user',
        git_email: null,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        effective_settings: {
          git_username: 'project.user',
          git_email: 'global@example.com',
          source: {
            git_username: 'project',
            git_email: 'global',
          },
        },
      };

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMixedSource,
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      const source = state.projectSettings[projectId].effective_settings?.source;
      expect(source?.git_username).toBe('project');
      expect(source?.git_email).toBe('global');
    });

    it('サーバーエラーの場合にエラーメッセージを設定する', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).not.toBeNull();
    });
  });

  describe('updateProjectSettings', () => {
    const projectId = 'project-uuid-1';

    it('プロジェクト設定を更新してsuccessMessageを設定する', async () => {
      const updated: ProjectSettingsResponse = {
        id: 'proj-1',
        scope: 'PROJECT',
        project_id: projectId,
        git_username: 'updated.user',
        git_email: 'updated@company.com',
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-20T10:30:00Z',
      };

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      } as Response);

      await useDeveloperSettingsStore.getState().updateProjectSettings(projectId, {
        git_username: 'updated.user',
      });

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toEqual(updated);
      expect(state.successMessage).toBe('設定を保存しました');
    });
  });

  describe('deleteProjectSettings', () => {
    const projectId = 'project-uuid-1';

    it('プロジェクト設定を削除してストアから除去しsuccessMessageを設定する', async () => {
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

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await useDeveloperSettingsStore.getState().deleteProjectSettings(projectId);

      const state = useDeveloperSettingsStore.getState();
      expect(state.projectSettings[projectId]).toBeUndefined();
      expect(state.successMessage).toBe('プロジェクト設定を削除しました');
    });

    it('204以外の成功レスポンス（200）でも削除できる', async () => {
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

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      await useDeveloperSettingsStore.getState().deleteProjectSettings(projectId);

      expect(useDeveloperSettingsStore.getState().projectSettings[projectId]).toBeUndefined();
    });
  });

  // =====================
  // SSH鍵
  // =====================
  describe('fetchSshKeys', () => {
    const mockKeys: SshKey[] = [
      {
        id: 'key-1',
        name: 'My SSH Key',
        public_key: 'ssh-rsa AAAA...',
        fingerprint: 'SHA256:abc123',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'key-2',
        name: 'Work Key',
        public_key: 'ssh-ed25519 BBBB...',
        fingerprint: null,
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    it('SSH鍵一覧を取得してストアに保存する', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: mockKeys }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchSshKeys();

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toEqual(mockKeys);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith('/api/ssh-keys');
    });

    it('キーがない場合は空配列になる', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: undefined }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchSshKeys();

      expect(useDeveloperSettingsStore.getState().sshKeys).toEqual([]);
    });

    it('fingerprint フィールドを含むSshKey型をサポートする', async () => {
      const keyWithFingerprint: SshKey = {
        id: 'key-fp',
        name: 'Fingerprint Key',
        public_key: 'ssh-rsa DDDD...',
        fingerprint: 'SHA256:xyz789',
        created_at: '2024-01-03T00:00:00Z',
      };

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [keyWithFingerprint] }),
      } as Response);

      await useDeveloperSettingsStore.getState().fetchSshKeys();

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys[0].fingerprint).toBe('SHA256:xyz789');
    });
  });

  describe('registerSshKey', () => {
    const newKey: SshKey = {
      id: 'key-new',
      name: 'New Key',
      public_key: 'ssh-rsa CCCC...',
      fingerprint: null,
      created_at: '2024-01-10T00:00:00Z',
    };

    it('SSH鍵を登録してストアに追加しsuccessMessageを設定する', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ key: newKey }),
      } as Response);

      await useDeveloperSettingsStore.getState().registerSshKey({
        name: 'New Key',
        private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
      });

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toContainEqual(newKey);
      expect(state.successMessage).toBe('SSH鍵を登録しました');
    });

    it('エラー時にエラーメッセージを設定してthrowする', async () => {
      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { message: 'Duplicate name' } }),
      } as Response);

      await expect(
        useDeveloperSettingsStore.getState().registerSshKey({
          name: 'Existing Key',
          private_key: '...',
        })
      ).rejects.toThrow();

      expect(useDeveloperSettingsStore.getState().error).not.toBeNull();
    });
  });

  describe('deleteSshKey', () => {
    it('SSH鍵を削除してストアから除去しsuccessMessageを設定する', async () => {
      useDeveloperSettingsStore.setState({
        sshKeys: [
          { id: 'key-1', name: 'Key 1', public_key: 'ssh-rsa AAA', fingerprint: null, created_at: '2024-01-01T00:00:00Z' },
          { id: 'key-2', name: 'Key 2', public_key: 'ssh-rsa BBB', fingerprint: null, created_at: '2024-01-02T00:00:00Z' },
        ],
      });

      vi.mocked(fetchMock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await useDeveloperSettingsStore.getState().deleteSshKey('key-1');

      const state = useDeveloperSettingsStore.getState();
      expect(state.sshKeys).toHaveLength(1);
      expect(state.sshKeys[0].id).toBe('key-2');
      expect(state.successMessage).toBe('SSH鍵を削除しました');
    });
  });

  // =====================
  // successMessage / error 管理
  // =====================
  describe('clearError', () => {
    it('エラーをクリアする', () => {
      useDeveloperSettingsStore.setState({ error: 'some error' });
      useDeveloperSettingsStore.getState().clearError();
      expect(useDeveloperSettingsStore.getState().error).toBeNull();
    });
  });

  describe('clearSuccessMessage', () => {
    it('successMessageをクリアする', () => {
      useDeveloperSettingsStore.setState({ successMessage: '設定を保存しました' });
      useDeveloperSettingsStore.getState().clearSuccessMessage();
      expect(useDeveloperSettingsStore.getState().successMessage).toBeNull();
    });
  });

  describe('状態管理', () => {
    it('アクション開始時にsuccessMessageとerrorがクリアされる', async () => {
      useDeveloperSettingsStore.setState({
        error: '前回のエラー',
        successMessage: '前回の成功メッセージ',
      });

      vi.mocked(fetchMock).mockResolvedValueOnce({
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

      await useDeveloperSettingsStore.getState().updateGlobalSettings({ git_username: 'test' });

      const state = useDeveloperSettingsStore.getState();
      expect(state.error).toBeNull();
      expect(state.successMessage).toBe('設定を保存しました');
    });
  });
});
