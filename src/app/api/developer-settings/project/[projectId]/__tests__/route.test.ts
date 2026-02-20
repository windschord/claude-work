import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ホイストされたモック関数
const {
  mockGetProjectSettings,
  mockUpdateProjectSettings,
  mockDeleteProjectSettings,
  mockGetEffectiveSettings,
  mockProjectGet,
} = vi.hoisted(() => ({
  mockGetProjectSettings: vi.fn(),
  mockUpdateProjectSettings: vi.fn(),
  mockDeleteProjectSettings: vi.fn(),
  mockGetEffectiveSettings: vi.fn(),
  mockProjectGet: vi.fn(),
}));

vi.mock('@/services/developer-settings-service', () => {
  return {
    DeveloperSettingsService: class {
      getProjectSettings = mockGetProjectSettings;
      updateProjectSettings = mockUpdateProjectSettings;
      deleteProjectSettings = mockDeleteProjectSettings;
      getEffectiveSettings = mockGetEffectiveSettings;
    },
    SettingsNotFoundError: class SettingsNotFoundError extends Error {
      constructor(scope: string, projectId?: string) {
        const target = projectId ? `project ${projectId}` : scope;
        super(`Settings not found: ${target}`);
        this.name = 'SettingsNotFoundError';
      }
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockProjectGet,
        }),
      }),
    }),
  },
  schema: {
    projects: {
      id: 'id',
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET, PUT, DELETE } from '../route';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

function createContext(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

describe('/api/developer-settings/project/[projectId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectGet.mockReturnValue({ id: PROJECT_ID, name: 'Test Project' });
  });

  describe('GET /api/developer-settings/project/:projectId', () => {
    it('プロジェクト設定と有効な設定を取得できる', async () => {
      const projectSettings = {
        id: 'settings-2',
        scope: 'PROJECT',
        project_id: PROJECT_ID,
        git_username: 'work.user',
        git_email: 'work@company.com',
        created_at: new Date('2024-01-10T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      const effectiveSettings = {
        git_username: 'work.user',
        git_email: 'work@company.com',
        source: {
          git_username: 'project',
          git_email: 'project',
        },
      };

      mockGetProjectSettings.mockResolvedValue(projectSettings);
      mockGetEffectiveSettings.mockResolvedValue(effectiveSettings);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`
      );
      const response = await GET(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('settings-2');
      expect(data.scope).toBe('PROJECT');
      expect(data.project_id).toBe(PROJECT_ID);
      expect(data.git_username).toBe('work.user');
      expect(data.git_email).toBe('work@company.com');
      expect(data.effective_settings).toBeDefined();
      expect(data.effective_settings.git_username).toBe('work.user');
      expect(data.effective_settings.source).toEqual({
        git_username: 'project',
        git_email: 'project',
      });
    });

    it('プロジェクト設定がない場合、グローバル設定をeffective_settingsとして返す', async () => {
      const effectiveSettings = {
        git_username: 'john.doe',
        git_email: 'john@example.com',
        source: {
          git_username: 'global',
          git_email: 'global',
        },
      };

      mockGetProjectSettings.mockResolvedValue(null);
      mockGetEffectiveSettings.mockResolvedValue(effectiveSettings);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`
      );
      const response = await GET(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeNull();
      expect(data.scope).toBe('PROJECT');
      expect(data.project_id).toBe(PROJECT_ID);
      expect(data.git_username).toBeNull();
      expect(data.git_email).toBeNull();
      expect(data.effective_settings.git_username).toBe('john.doe');
      expect(data.effective_settings.source).toEqual({
        git_username: 'global',
        git_email: 'global',
      });
    });

    it('プロジェクトが存在しない場合は404を返す', async () => {
      mockProjectGet.mockReturnValue(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`
      );
      const response = await GET(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('プロジェクト');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockGetProjectSettings.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`
      );
      const response = await GET(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/developer-settings/project/:projectId', () => {
    it('プロジェクト設定を更新できる', async () => {
      const updatedSettings = {
        id: 'settings-2',
        scope: 'PROJECT',
        project_id: PROJECT_ID,
        git_username: 'work.user',
        git_email: 'work@company.com',
        created_at: new Date('2024-01-10T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockUpdateProjectSettings.mockResolvedValue(updatedSettings);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            git_username: 'work.user',
            git_email: 'work@company.com',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('settings-2');
      expect(data.scope).toBe('PROJECT');
      expect(data.project_id).toBe(PROJECT_ID);
      expect(data.git_username).toBe('work.user');
      expect(data.git_email).toBe('work@company.com');
      expect(mockUpdateProjectSettings).toHaveBeenCalledWith(PROJECT_ID, {
        git_username: 'work.user',
        git_email: 'work@company.com',
      });
    });

    it('プロジェクトが存在しない場合は404を返す', async () => {
      mockProjectGet.mockReturnValue(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            git_username: 'work.user',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('プロジェクト');
    });

    it('不正なメールアドレス形式の場合は400を返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            git_email: 'invalid-email',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.field).toBe('git_email');
    });

    it('git_usernameが100文字を超える場合は400を返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            git_username: 'a'.repeat(101),
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.field).toBe('git_username');
    });

    it('両方のフィールドが未指定の場合は400を返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なJSONの場合は400を返す', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockUpdateProjectSettings.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            git_username: 'work.user',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('DELETE /api/developer-settings/project/:projectId', () => {
    it('プロジェクト設定を削除できる', async () => {
      mockDeleteProjectSettings.mockResolvedValue(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, createContext(PROJECT_ID));

      expect(response.status).toBe(204);
      expect(mockDeleteProjectSettings).toHaveBeenCalledWith(PROJECT_ID);
    });

    it('プロジェクトが存在しない場合は404を返す', async () => {
      mockProjectGet.mockReturnValue(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('プロジェクト');
    });

    it('プロジェクト設定が存在しない場合は404を返す', async () => {
      const { SettingsNotFoundError } = await import('@/services/developer-settings-service');
      mockDeleteProjectSettings.mockRejectedValue(
        new SettingsNotFoundError('PROJECT', PROJECT_ID)
      );

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('プロジェクト設定');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockDeleteProjectSettings.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        `http://localhost:3000/api/developer-settings/project/${PROJECT_ID}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, createContext(PROJECT_ID));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
