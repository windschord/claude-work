import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import type { Project } from '@/lib/db';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../../scripts/__tests__/test-helpers';

vi.mock('@/services/env-file-service', () => ({
  EnvFileService: {
    validatePath: vi.fn(),
    readEnvFile: vi.fn(),
  },
}));

vi.mock('@/services/dotenv-parser', () => ({
  parseDotenv: vi.fn(),
}));

import { EnvFileService } from '@/services/env-file-service';
import { parseDotenv } from '@/services/dotenv-parser';

describe('POST /api/projects/[project_id]/env-files/parse', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    const env = await setupTestEnvironment();
    testRepoPath = env.testRepoPath;
    project = env.project;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testRepoPath);
    vi.restoreAllMocks();
  });

  it('should return 200 with parsed env variables', async () => {
    vi.mocked(EnvFileService.validatePath).mockImplementation(() => {});
    vi.mocked(EnvFileService.readEnvFile).mockResolvedValue('DB_HOST=localhost\nDB_PORT=5432');
    vi.mocked(parseDotenv).mockReturnValue({
      variables: { DB_HOST: 'localhost', DB_PORT: '5432' },
      errors: [],
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '.env' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.variables).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
    expect(data.errors).toEqual([]);
    expect(EnvFileService.validatePath).toHaveBeenCalledWith(project.path, '.env');
    expect(EnvFileService.readEnvFile).toHaveBeenCalledWith(
      project.path,
      '.env',
      project.clone_location,
      project.docker_volume_id,
    );
    expect(parseDotenv).toHaveBeenCalledWith('DB_HOST=localhost\nDB_PORT=5432');
  });

  it('should return 404 when project not found', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent-id/env-files/parse',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '.env' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: 'non-existent-id' }),
    });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });

  it('should return 400 when path is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('path');
  });

  it('should return 400 when path is empty string', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);
  });

  it('should return 400 when path traversal detected', async () => {
    vi.mocked(EnvFileService.validatePath).mockImplementation(() => {
      throw new Error('パストラバーサルが検出されました: ../../.env');
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '../../.env' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('パストラバーサル');
  });

  it('should return 400 when file is not an env file', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'config.json' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('.env');
  });

  it('should return 404 when env file not found', async () => {
    vi.mocked(EnvFileService.validatePath).mockImplementation(() => {});
    vi.mocked(EnvFileService.readEnvFile).mockRejectedValue(
      Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
    );

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '.env.missing' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(404);
  });

  it('should return 413 when file exceeds size limit', async () => {
    vi.mocked(EnvFileService.validatePath).mockImplementation(() => {});
    vi.mocked(EnvFileService.readEnvFile).mockRejectedValue(
      new Error('ファイルサイズが1MBを超えています: .env.huge (2000000 bytes)')
    );

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files/parse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '.env.huge' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(413);
  });
});
