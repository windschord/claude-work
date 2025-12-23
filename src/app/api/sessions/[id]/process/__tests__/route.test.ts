import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

vi.mock('@/services/process-manager', () => {
  const mockHasProcess = vi.fn();
  const mockStartClaudeCode = vi.fn();
  return {
    ProcessManager: {
      getInstance: vi.fn(() => ({
        hasProcess: mockHasProcess,
        startClaudeCode: mockStartClaudeCode,
      })),
    },
    mockHasProcess,
    mockStartClaudeCode,
  };
});

const { mockHasProcess, mockStartClaudeCode } = await import('@/services/process-manager') as {
  mockHasProcess: ReturnType<typeof vi.fn>;
  mockStartClaudeCode: ReturnType<typeof vi.fn>;
};

describe('GET /api/sessions/[id]/process', () => {
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

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return { running: true } when process is running', async () => {
    mockHasProcess.mockReturnValue(true);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: true });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
  });

  it('should return { running: false } when process is not running', async () => {
    mockHasProcess.mockReturnValue(false);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: false });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/process', {
      method: 'GET',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ error: 'Session not found' });
  });
});

describe('POST /api/sessions/[id]/process', () => {
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

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should start process and return { success: true, running: true }', async () => {
    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockResolvedValue({
      sessionId: session.id,
      pid: 12345,
      status: 'running',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
    expect(mockStartClaudeCode).toHaveBeenCalledWith({
      sessionId: session.id,
      worktreePath: session.worktree_path,
      prompt: '',
      model: session.model,
    });
  });

  it('should return { success: true, running: true, message: "Process already running" } when process is already running', async () => {
    mockHasProcess.mockReturnValue(true);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true, message: 'Process already running' });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
    expect(mockStartClaudeCode).not.toHaveBeenCalled();
  });

  it('should return 500 when process fails to start', async () => {
    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockRejectedValue(new Error('Failed to start process'));

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/process', {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ error: 'Session not found' });
  });
});
