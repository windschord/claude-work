import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

vi.mock('@/services/process-manager', () => ({
  ProcessManager: class {
    startClaudeCode = vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      pid: 12345,
      status: 'running',
    });
    stop = vi.fn().mockResolvedValue(undefined);
    getStatus = vi.fn().mockReturnValue({
      sessionId: 'test-session',
      pid: 12345,
      status: 'running',
    });
  },
}));

describe('GET /api/projects/[project_id]/sessions', () => {
  let testRepoPath: string;
  let authSession: any;
  let project: any;

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

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: '/bin/bash',
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

  it('should return 200 and list of sessions for a project', async () => {
    await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { project_id: project.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Test Session');
    expect(data[0].project_id).toBe(project.id);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`
    );

    const response = await GET(request, { params: { project_id: project.id } });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/projects/[project_id]/sessions', () => {
  let testRepoPath: string;
  let authSession: any;
  let project: any;

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

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: '/bin/bash',
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

  it('should create session with worktree', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'test prompt',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: { project_id: project.id } });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.name).toBe('New Session');
    expect(data.project_id).toBe(project.id);
    expect(data.status).toBe('running');
    expect(data.worktree_path).toBeTruthy();
    expect(data.branch_name).toBeTruthy();

    const session = await prisma.session.findFirst({
      where: { project_id: project.id },
    });
    expect(session).toBeTruthy();
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent/sessions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'test prompt',
        }),
      }
    );

    const response = await POST(request, { params: { project_id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'test prompt',
        }),
      }
    );

    const response = await POST(request, { params: { project_id: project.id } });
    expect(response.status).toBe(401);
  });
});
