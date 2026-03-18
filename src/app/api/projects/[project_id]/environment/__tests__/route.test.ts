import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- vi.hoisted でモックを初期化 ---
const {
  mockFindByProjectId,
  mockFindById,
  mockUpdate,
  mockCheckStatus,
  mockDbSelectGet,
  mockDbSelectAll,
  mockLogger,
  mockIsHostEnvironmentAllowed,
} = vi.hoisted(() => ({
  mockFindByProjectId: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockCheckStatus: vi.fn(),
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockIsHostEnvironmentAllowed: vi.fn(() => true),
}));

vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findByProjectId: mockFindByProjectId,
    findById: mockFindById,
    update: mockUpdate,
    checkStatus: mockCheckStatus,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: mockDbSelectAll,
        })),
      })),
    })),
    query: {
      projects: {
        findFirst: vi.fn(),
      },
      sessions: {
        findMany: vi.fn(),
      },
    },
  },
  schema: {
    projects: { id: 'id', environment_id: 'environment_id' },
    sessions: { project_id: 'project_id', status: 'status', session_state: 'session_state' },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

vi.mock('@/lib/environment-detect', () => ({
  isHostEnvironmentAllowed: mockIsHostEnvironmentAllowed,
}));

vi.mock('@/lib/docker-config-validator', () => ({
  validatePortMappings: vi.fn(() => ({ valid: true, errors: [] })),
  validateVolumeMounts: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...conditions) => ({ conditions })),
  isNotNull: vi.fn((col) => ({ col })),
}));

import { GET, PUT } from '../route';

describe('GET /api/projects/[project_id]/environment', () => {
  const makeParams = (project_id: string) =>
    ({ params: Promise.resolve({ project_id }) });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('プロジェクトの環境を返す', async () => {
    const mockEnv = {
      id: 'env-123',
      name: 'Test Env',
      type: 'DOCKER',
      description: null,
      config: '{"imageName":"test"}',
      project_id: 'proj-123',
      auth_dir_path: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockFindByProjectId.mockResolvedValue(mockEnv);

    const request = new NextRequest('http://localhost/api/projects/proj-123/environment');
    const response = await GET(request, makeParams('proj-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.environment).toEqual(mockEnv);
  });

  it('includeStatus=true でステータスを含める', async () => {
    const mockEnv = {
      id: 'env-123',
      name: 'Test Env',
      type: 'DOCKER',
      config: '{}',
      project_id: 'proj-123',
      auth_dir_path: null,
    };
    const mockStatus = { available: true, authenticated: true };

    mockFindByProjectId.mockResolvedValue(mockEnv);
    mockCheckStatus.mockResolvedValue(mockStatus);

    const request = new NextRequest('http://localhost/api/projects/proj-123/environment?includeStatus=true');
    const response = await GET(request, makeParams('proj-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.environment.status).toEqual(mockStatus);
  });

  it('環境が存在しない場合は404を返す', async () => {
    mockFindByProjectId.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/proj-notfound/environment');
    const response = await GET(request, makeParams('proj-notfound'));

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/projects/[project_id]/environment', () => {
  const makeParams = (project_id: string) =>
    ({ params: Promise.resolve({ project_id }) });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('name, description, config を更新できる', async () => {
    const existing = {
      id: 'env-123',
      name: 'Old Name',
      type: 'DOCKER',
      config: '{}',
      project_id: 'proj-123',
    };
    const updated = { ...existing, name: 'New Name', description: 'New Desc' };

    mockFindByProjectId.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(updated);
    // sessions: アクティブなし
    const { db } = await import('@/lib/db');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(null),
          all: vi.fn().mockReturnValue([]),
        }),
      }),
    } as ReturnType<typeof db.select>);

    const request = new NextRequest('http://localhost/api/projects/proj-123/environment', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name', description: 'New Desc' }),
    });
    const response = await PUT(request, makeParams('proj-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.environment).toEqual(updated);
  });

  it('環境が存在しない場合は404を返す', async () => {
    mockFindByProjectId.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/proj-notfound/environment', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PUT(request, makeParams('proj-notfound'));

    expect(response.status).toBe(404);
  });

  it('name が空文字の場合は400を返す', async () => {
    const existing = {
      id: 'env-123',
      name: 'Old',
      type: 'DOCKER',
      config: '{}',
      project_id: 'proj-123',
    };
    mockFindByProjectId.mockResolvedValue(existing);

    const request = new NextRequest('http://localhost/api/projects/proj-123/environment', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PUT(request, makeParams('proj-123'));

    expect(response.status).toBe(400);
  });

  it('config.skipPermissions が boolean でない場合は400を返す', async () => {
    const existing = {
      id: 'env-123',
      name: 'Test',
      type: 'DOCKER',
      config: '{}',
      project_id: 'proj-123',
    };
    mockFindByProjectId.mockResolvedValue(existing);

    const request = new NextRequest('http://localhost/api/projects/proj-123/environment', {
      method: 'PUT',
      body: JSON.stringify({ config: { skipPermissions: 'yes' } }),
    });
    const response = await PUT(request, makeParams('proj-123'));

    expect(response.status).toBe(400);
  });
});
