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

describe('GET /api/sessions/[id]/commits', () => {
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

    testRepoPath = mkdtempSync(join(tmpdir(), 'commits-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial commit"', {
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

    // Create worktree and make some commits
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );
    writeFileSync(join(session.worktree_path, 'file1.txt'), 'content 1');
    execSync('git add . && git commit -m "Add file1"', {
      cwd: session.worktree_path,
      shell: true,
    });
    writeFileSync(join(session.worktree_path, 'file2.txt'), 'content 2');
    execSync('git add . && git commit -m "Add file2"', {
      cwd: session.worktree_path,
      shell: true,
    });
    writeFileSync(join(session.worktree_path, 'file3.txt'), 'content 3');
    execSync('git add . && git commit -m "Add file3"', {
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

  it('should return commit history with correct structure', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('commits');
    expect(Array.isArray(data.commits)).toBe(true);
    expect(data.commits.length).toBeGreaterThan(0);
  });

  it('should return commits with all required fields', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    const firstCommit = data.commits[0];

    // 各コミットが必要なフィールドを持っているか確認
    expect(firstCommit).toHaveProperty('hash');
    expect(firstCommit).toHaveProperty('shortHash');
    expect(firstCommit).toHaveProperty('message');
    expect(firstCommit).toHaveProperty('author');
    expect(firstCommit).toHaveProperty('email');
    expect(firstCommit).toHaveProperty('date');
    expect(firstCommit).toHaveProperty('filesChanged');

    // フィールドの型を確認
    expect(typeof firstCommit.hash).toBe('string');
    expect(typeof firstCommit.shortHash).toBe('string');
    expect(typeof firstCommit.message).toBe('string');
    expect(typeof firstCommit.author).toBe('string');
    expect(typeof firstCommit.email).toBe('string');
    expect(typeof firstCommit.date).toBe('string');
    expect(typeof firstCommit.filesChanged).toBe('number');

    // ハッシュの形式を確認
    expect(firstCommit.hash.length).toBe(40); // Full SHA-1 hash
    expect(firstCommit.shortHash.length).toBeGreaterThanOrEqual(6);
    expect(firstCommit.shortHash.length).toBeLessThanOrEqual(7);
  });

  it('should return commits in chronological order (newest first)', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();

    // 最新のコミットが最初に来ることを確認
    expect(data.commits[0].message).toBe('Add file3');
    expect(data.commits[1].message).toBe('Add file2');
    expect(data.commits[2].message).toBe('Add file1');
  });

  it('should include correct author information', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    const firstCommit = data.commits[0];

    expect(firstCommit.author).toBe('Test User');
    expect(firstCommit.email).toBe('test@example.com');
  });

  it('should return correct filesChanged count', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(200);

    const data = await response.json();

    // 各コミットで1ファイルずつ変更されているはず
    data.commits.forEach((commit: { filesChanged: number }) => {
      expect(commit.filesChanged).toBeGreaterThanOrEqual(1);
    });
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/commits', {
      method: 'GET',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request, { params: { id: 'non-existent' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: { id: session.id } });
    expect(response.status).toBe(401);
  });

  it('should handle repository with no commits gracefully', async () => {
    // 新しい空のworktreeを持つセッションを作成
    const emptySession = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Empty Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: join(testRepoPath, '.worktrees', 'empty-session'),
        branch_name: 'empty-branch',
      },
    });

    execSync(
      `git worktree add -b ${emptySession.branch_name} ${emptySession.worktree_path}`,
      { cwd: testRepoPath }
    );

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${emptySession.id}/commits`,
      {
        method: 'GET',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: emptySession.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('commits');
    expect(Array.isArray(data.commits)).toBe(true);
    // initial commitは存在するはず
    expect(data.commits.length).toBeGreaterThanOrEqual(1);
  });
});
