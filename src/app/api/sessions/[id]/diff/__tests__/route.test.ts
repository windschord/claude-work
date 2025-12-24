import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

describe('GET /api/sessions/[id]/diff', () => {
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

    testRepoPath = mkdtempSync(join(tmpdir(), 'diff-test-'));
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

    // Create worktree and make some changes
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );
    writeFileSync(join(session.worktree_path, 'new-file.txt'), 'new content');
    writeFileSync(join(session.worktree_path, 'README.md'), 'modified content');
    execSync('git add . && git commit -m "test changes"', {
      cwd: session.worktree_path,
      shell: true,
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

  it('should return diff with added, modified, and deleted files', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/diff`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: session.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('diff');
    expect(data.diff).toHaveProperty('files');
    expect(data.diff).toHaveProperty('totalAdditions');
    expect(data.diff).toHaveProperty('totalDeletions');
    expect(Array.isArray(data.diff.files)).toBe(true);

    // 追加されたファイルを確認
    const addedFile = data.diff.files.find((f: { path: string; status: string }) => f.path === 'new-file.txt');
    expect(addedFile).toBeDefined();
    expect(addedFile.status).toBe('added');
    expect(addedFile.newContent).toContain('new content');

    // 変更されたファイルを確認
    const modifiedFile = data.diff.files.find((f: { path: string; status: string }) => f.path === 'README.md');
    expect(modifiedFile).toBeDefined();
    expect(modifiedFile.status).toBe('modified');
    expect(modifiedFile.oldContent).toContain('test');
    expect(modifiedFile.newContent).toContain('modified content');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/diff', {
      method: 'GET',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'non-existent' }),
    });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/diff`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: session.id }),
    });
    expect(response.status).toBe(401);
  });
});
