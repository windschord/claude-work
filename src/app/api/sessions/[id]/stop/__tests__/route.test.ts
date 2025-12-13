import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
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

describe('POST /api/sessions/[id]/stop', () => {
  let testRepoPath: string;
  let authSession: any;
  let project: any;
  let session: any;

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

  it('should stop session and return 200', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/stop`,
      {
        method: 'POST',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(session.id);
    expect(data.status).toBe('completed');

    const updatedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.status).toBe('completed');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/stop', {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: { id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });
});
