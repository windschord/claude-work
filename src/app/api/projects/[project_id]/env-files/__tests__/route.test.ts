import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import type { Project } from '@/lib/db';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../scripts/__tests__/test-helpers';

vi.mock('@/services/env-file-service', () => ({
  EnvFileService: {
    listEnvFiles: vi.fn(),
  },
}));

import { EnvFileService } from '@/services/env-file-service';

describe('GET /api/projects/[project_id]/env-files', () => {
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

  it('should return 200 and list of env files', async () => {
    vi.mocked(EnvFileService.listEnvFiles).mockResolvedValue(['.env', '.env.local', 'config/.env.production']);

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files`
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.files).toEqual(['.env', '.env.local', 'config/.env.production']);
    expect(EnvFileService.listEnvFiles).toHaveBeenCalledWith(
      project.path,
      project.clone_location,
      project.docker_volume_id,
    );
  });

  it('should return 200 with empty array when no env files exist', async () => {
    vi.mocked(EnvFileService.listEnvFiles).mockResolvedValue([]);

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/env-files`
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.files).toEqual([]);
  });

  it('should return 404 when project not found', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent-id/env-files'
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: 'non-existent-id' }),
    });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Project not found');
  });
});
