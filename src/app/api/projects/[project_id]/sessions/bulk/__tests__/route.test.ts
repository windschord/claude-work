import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project } from '@prisma/client';

vi.mock('@/services/process-manager', () => ({
  ProcessManager: {
    getInstance: () => ({
      startClaudeCode: vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      }),
    }),
  },
}));

describe('POST /api/projects/[project_id]/sessions/bulk', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();

    authSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        token_hash: 'test-hash',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    testRepoPath = mkdtempSync(join(tmpdir(), 'bulk-session-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
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
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should create multiple sessions with worktrees', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          model: 'sonnet',
          count: 3,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.sessions).toHaveLength(3);
    expect(data.sessions[0].name).toBe('Bulk Session-1');
    expect(data.sessions[1].name).toBe('Bulk Session-2');
    expect(data.sessions[2].name).toBe('Bulk Session-3');

    for (const session of data.sessions) {
      expect(session.project_id).toBe(project.id);
      expect(session.status).toBe('running');
      expect(session.worktree_path).toBeTruthy();
      expect(session.branch_name).toBeTruthy();
    }

    const sessions = await prisma.session.findMany({
      where: { project_id: project.id },
    });
    expect(sessions).toHaveLength(3);
  });

  it('should return 400 if count is less than 2', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          count: 1,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Count must be between 2 and 10');
  });

  it('should return 400 if count is greater than 10', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          count: 11,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Count must be between 2 and 10');
  });

  it('should return 400 if name is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          prompt: 'test prompt',
          count: 3,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Name, prompt, and count are required');
  });

  it('should return 400 if prompt is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          count: 3,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Name, prompt, and count are required');
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent/sessions/bulk',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          count: 3,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          count: 3,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(401);
  });

  it('should use default model when model is not specified', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Bulk Session',
          prompt: 'test prompt',
          count: 2,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0].model).toBe('auto');
    expect(data.sessions[1].model).toBe('auto');
  });
});
