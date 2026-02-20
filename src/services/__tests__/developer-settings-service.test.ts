import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbUpdateGet,
  mockDbDeleteRun,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
  mockDbUpdateGet: vi.fn(),
  mockDbDeleteRun: vi.fn(),
}));

// Drizzle DBのモック
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: mockDbSelectAll,
        })),
        get: mockDbSelectGet,
        all: mockDbSelectAll,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockDbInsertGet,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbUpdateGet,
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockDbDeleteRun,
      })),
    })),
  },
  schema: {
    developerSettings: {
      id: 'id',
      scope: 'scope',
      project_id: 'project_id',
      git_username: 'git_username',
      git_email: 'git_email',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  isNull: vi.fn((col) => ({ type: 'isNull', column: col })),
}));

import {
  DeveloperSettingsService,
  SettingsNotFoundError,
} from '../developer-settings-service';

describe('DeveloperSettingsService', () => {
  let service: DeveloperSettingsService;

  const now = new Date('2026-02-19T12:00:00Z');
  const later = new Date('2026-02-19T14:00:00Z');

  const mockGlobalRecord = {
    id: 'settings-uuid-global',
    scope: 'GLOBAL' as const,
    project_id: null,
    git_username: 'global-user',
    git_email: 'global@example.com',
    created_at: now,
    updated_at: now,
  };

  const mockProjectRecord = {
    id: 'settings-uuid-project',
    scope: 'PROJECT' as const,
    project_id: 'project-uuid-1',
    git_username: 'project-user',
    git_email: 'project@example.com',
    created_at: now,
    updated_at: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeveloperSettingsService();
  });

  // ==================== getGlobalSettings ====================

  describe('getGlobalSettings', () => {
    it('グローバル設定が存在する場合、設定を返す', async () => {
      mockDbSelectGet.mockReturnValue(mockGlobalRecord);

      const result = await service.getGlobalSettings();

      expect(result).toEqual(mockGlobalRecord);
    });

    it('グローバル設定が存在しない場合、nullを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.getGlobalSettings();

      expect(result).toBeNull();
    });
  });

  // ==================== updateGlobalSettings ====================

  describe('updateGlobalSettings', () => {
    it('グローバル設定が存在しない場合、新規作成する', async () => {
      mockDbSelectGet.mockReturnValue(undefined);
      mockDbInsertGet.mockReturnValue(mockGlobalRecord);

      const result = await service.updateGlobalSettings({
        git_username: 'global-user',
        git_email: 'global@example.com',
      });

      expect(result).toEqual(mockGlobalRecord);
    });

    it('グローバル設定が存在する場合、更新する', async () => {
      const updatedRecord = {
        ...mockGlobalRecord,
        git_username: 'updated-user',
        updated_at: later,
      };
      mockDbSelectGet.mockReturnValue(mockGlobalRecord);
      mockDbUpdateGet.mockReturnValue(updatedRecord);

      const result = await service.updateGlobalSettings({
        git_username: 'updated-user',
      });

      expect(result).toEqual(updatedRecord);
    });

    it('部分的な更新ができる（usernameのみ）', async () => {
      const updatedRecord = {
        ...mockGlobalRecord,
        git_username: 'new-username',
        updated_at: later,
      };
      mockDbSelectGet.mockReturnValue(mockGlobalRecord);
      mockDbUpdateGet.mockReturnValue(updatedRecord);

      const result = await service.updateGlobalSettings({
        git_username: 'new-username',
      });

      expect(result.git_username).toBe('new-username');
      expect(result.git_email).toBe('global@example.com');
    });

    it('部分的な更新ができる（emailのみ）', async () => {
      const updatedRecord = {
        ...mockGlobalRecord,
        git_email: 'new@example.com',
        updated_at: later,
      };
      mockDbSelectGet.mockReturnValue(mockGlobalRecord);
      mockDbUpdateGet.mockReturnValue(updatedRecord);

      const result = await service.updateGlobalSettings({
        git_email: 'new@example.com',
      });

      expect(result.git_email).toBe('new@example.com');
      expect(result.git_username).toBe('global-user');
    });
  });

  // ==================== getProjectSettings ====================

  describe('getProjectSettings', () => {
    it('プロジェクト設定が存在する場合、設定を返す', async () => {
      mockDbSelectGet.mockReturnValue(mockProjectRecord);

      const result = await service.getProjectSettings('project-uuid-1');

      expect(result).toEqual(mockProjectRecord);
    });

    it('プロジェクト設定が存在しない場合、nullを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.getProjectSettings('project-uuid-1');

      expect(result).toBeNull();
    });
  });

  // ==================== updateProjectSettings ====================

  describe('updateProjectSettings', () => {
    it('プロジェクト設定が存在しない場合、新規作成する', async () => {
      mockDbSelectGet.mockReturnValue(undefined);
      mockDbInsertGet.mockReturnValue(mockProjectRecord);

      const result = await service.updateProjectSettings('project-uuid-1', {
        git_username: 'project-user',
        git_email: 'project@example.com',
      });

      expect(result).toEqual(mockProjectRecord);
    });

    it('プロジェクト設定が存在する場合、更新する', async () => {
      const updatedRecord = {
        ...mockProjectRecord,
        git_username: 'updated-project-user',
        updated_at: later,
      };
      mockDbSelectGet.mockReturnValue(mockProjectRecord);
      mockDbUpdateGet.mockReturnValue(updatedRecord);

      const result = await service.updateProjectSettings('project-uuid-1', {
        git_username: 'updated-project-user',
      });

      expect(result).toEqual(updatedRecord);
    });
  });

  // ==================== deleteProjectSettings ====================

  describe('deleteProjectSettings', () => {
    it('プロジェクト設定を削除する', async () => {
      mockDbSelectGet.mockReturnValue(mockProjectRecord);

      await expect(service.deleteProjectSettings('project-uuid-1')).resolves.toBeUndefined();
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });

    it('存在しないプロジェクト設定を削除しようとした場合、SettingsNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(
        service.deleteProjectSettings('non-existent-project')
      ).rejects.toThrow(SettingsNotFoundError);
    });
  });

  // ==================== getEffectiveSettings ====================

  describe('getEffectiveSettings', () => {
    it('プロジェクト設定とグローバル設定の両方が存在する場合、プロジェクト設定を優先する', async () => {
      // 1回目: getProjectSettings -> プロジェクト設定
      // 2回目: getGlobalSettings -> グローバル設定
      mockDbSelectGet
        .mockReturnValueOnce(mockProjectRecord)
        .mockReturnValueOnce(mockGlobalRecord);

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBe('project-user');
      expect(result.git_email).toBe('project@example.com');
      expect(result.source.git_username).toBe('project');
      expect(result.source.git_email).toBe('project');
    });

    it('プロジェクト設定が存在しない場合、グローバル設定にフォールバックする', async () => {
      mockDbSelectGet
        .mockReturnValueOnce(undefined)  // プロジェクト設定なし
        .mockReturnValueOnce(mockGlobalRecord);  // グローバル設定あり

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBe('global-user');
      expect(result.git_email).toBe('global@example.com');
      expect(result.source.git_username).toBe('global');
      expect(result.source.git_email).toBe('global');
    });

    it('両方の設定が存在しない場合、null値を返す', async () => {
      mockDbSelectGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBeNull();
      expect(result.git_email).toBeNull();
      expect(result.source.git_username).toBeNull();
      expect(result.source.git_email).toBeNull();
    });

    it('フィールドレベルの優先順位解決: usernameはプロジェクト、emailはグローバル', async () => {
      const partialProjectRecord = {
        ...mockProjectRecord,
        git_username: 'project-user',
        git_email: null,  // プロジェクトにemailなし
      };

      mockDbSelectGet
        .mockReturnValueOnce(partialProjectRecord)
        .mockReturnValueOnce(mockGlobalRecord);

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBe('project-user');
      expect(result.git_email).toBe('global@example.com');
      expect(result.source.git_username).toBe('project');
      expect(result.source.git_email).toBe('global');
    });

    it('フィールドレベルの優先順位解決: usernameはグローバル、emailはプロジェクト', async () => {
      const partialProjectRecord = {
        ...mockProjectRecord,
        git_username: null,  // プロジェクトにusernameなし
        git_email: 'project@example.com',
      };

      mockDbSelectGet
        .mockReturnValueOnce(partialProjectRecord)
        .mockReturnValueOnce(mockGlobalRecord);

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBe('global-user');
      expect(result.git_email).toBe('project@example.com');
      expect(result.source.git_username).toBe('global');
      expect(result.source.git_email).toBe('project');
    });

    it('グローバル設定のみで部分的なフィールドがある場合', async () => {
      const partialGlobalRecord = {
        ...mockGlobalRecord,
        git_username: 'global-user',
        git_email: null,  // グローバルにemailなし
      };

      mockDbSelectGet
        .mockReturnValueOnce(undefined)  // プロジェクト設定なし
        .mockReturnValueOnce(partialGlobalRecord);

      const result = await service.getEffectiveSettings('project-uuid-1');

      expect(result.git_username).toBe('global-user');
      expect(result.git_email).toBeNull();
      expect(result.source.git_username).toBe('global');
      expect(result.source.git_email).toBeNull();
    });
  });
});
