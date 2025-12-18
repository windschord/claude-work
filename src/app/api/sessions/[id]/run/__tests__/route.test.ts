import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

vi.mock('@/services/run-script-manager', () => ({
  RunScriptManager: class {
    static getInstance = vi.fn().mockReturnValue({
      runScript: vi.fn().mockResolvedValue('test-run-id'),
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({
        runId: 'test-run-id',
        sessionId: 'test-session',
        command: 'npm test',
        pid: 12345,
        status: 'running',
      }),
    });
  },
}));

describe('POST /api/sessions/[id]/run', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    await prisma.runScript.deleteMany();
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

    testRepoPath = mkdtempSync(join(tmpdir(), 'run-script-test-'));
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
        model: 'sonnet',
        worktree_path: worktreePath,
        branch_name: 'test-branch',
      },
    });

    await prisma.runScript.create({
      data: {
        project_id: project.id,
        name: 'test',
        description: 'Test script',
        command: 'npm test',
      },
    });
  });

  afterEach(async () => {
    await prisma.runScript.deleteMany();
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should execute run script and return run_id', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({ script_name: 'test' }),
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(202);

    const data = await response.json();
    expect(data).toHaveProperty('run_id');
    expect(data.run_id).toBe('test-run-id');
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ script_name: 'test' }),
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });

  it('should return 404 if session not found', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({ script_name: 'test' }),
    });

    const response = await POST(request, { params: { id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 404 if script not found', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({ script_name: 'non-existent' }),
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(404);
  });

  it('should return 400 if script_name is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(400);
  });
});
