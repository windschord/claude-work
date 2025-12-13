import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

describe('POST /api/sessions/[id]/rebase', () => {
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

    testRepoPath = mkdtempSync(join(tmpdir(), 'rebase-test-'));
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

  it('should rebase successfully and return 200', async () => {
    // Create worktree and make a non-conflicting change
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );
    writeFileSync(join(session.worktree_path, 'new-file.txt'), 'new content');
    execSync('git add . && git commit -m "add new file"', {
      cwd: session.worktree_path,
      shell: '/bin/bash',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/rebase`,
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
    expect(data.success).toBe(true);
    expect(data.conflicts).toBeUndefined();
  });

  it('should return 409 with conflict files when rebase has conflicts', async () => {
    // Create worktree and make a conflicting change
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );
    writeFileSync(join(session.worktree_path, 'README.md'), 'branch content');
    execSync('git add . && git commit -m "modify README in branch"', {
      cwd: session.worktree_path,
      shell: '/bin/bash',
    });

    // Make conflicting change in main
    writeFileSync(join(testRepoPath, 'README.md'), 'main content');
    execSync('git add . && git commit -m "modify README in main"', {
      cwd: testRepoPath,
      shell: '/bin/bash',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/rebase`,
      {
        method: 'POST',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.conflicts).toContain('README.md');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/rebase', {
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
      `http://localhost:3000/api/sessions/${session.id}/rebase`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });
});
