import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

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

describe('GET /api/sessions/[id]', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;
  let session: Session;

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
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
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

  it('should return 200 and session details', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(session.id);
    expect(data.name).toBe('Test Session');
    expect(data.status).toBe('running');
    expect(data.project_id).toBe(project.id);
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request, { params: { id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`);

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/sessions/[id]', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;
  let session: Session;

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
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
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

  it('should delete session and return 204', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'DELETE',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await DELETE(request, { params: { id: session.id } });
    expect(response.status).toBe(204);

    const deletedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(deletedSession).toBeNull();
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
      method: 'DELETE',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await DELETE(request, { params: { id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });
});
