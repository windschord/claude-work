import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session } from '@/lib/db';

const { mockStop, mockGetStatus } = vi.hoisted(() => ({
  mockStop: vi.fn().mockResolvedValue(undefined),
  mockGetStatus: vi.fn(),
}));

vi.mock('@/services/run-script-manager', () => ({
  RunScriptManager: class {
    static getInstance = vi.fn().mockReturnValue({
      runScript: vi.fn().mockResolvedValue('test-run-id'),
      stop: mockStop,
      getStatus: mockGetStatus,
    });
  },
}));

describe('POST /api/sessions/[id]/run/[run_id]/stop', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    vi.clearAllMocks();

    await prisma.session.deleteMany();
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'run-script-stop-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    writeFileSync(join(testRepoPath, 'README.md'), 'test');
    execSync('git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    const worktreePath = join(testRepoPath, '.worktrees', 'test-session');
    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: worktreePath,
        branch_name: 'test-branch',
      },
    });

    // Setup default mock behavior
    mockGetStatus.mockReturnValue({
      runId: 'test-run-id',
      sessionId: session.id,
      command: 'npm test',
      pid: 12345,
      status: 'running',
    });
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should stop running script and return 200', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run/test-run-id/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: session.id, run_id: 'test-run-id' }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(mockStop).toHaveBeenCalledWith('test-run-id');
  });

  it('should return 404 if session not found', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/sessions/non-existent/run/test-run-id/stop',
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'non-existent', run_id: 'test-run-id' }),
    });
    expect(response.status).toBe(404);
  });

  it('should return 404 if run_id not found', async () => {
    mockGetStatus.mockReturnValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run/non-existent-run-id/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: session.id, run_id: 'non-existent-run-id' }),
    });
    expect(response.status).toBe(404);
  });
});
