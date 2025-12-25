import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, Session } from '@prisma/client';

// execSync をモック（vi.hoisted を使用してホイスティング問題を回避）
const mockExecSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => {
  const mockExports = {
    execSync: mockExecSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

import { POST } from '../route';

describe('POST /api/sessions/[id]/pr', () => {
  let authSession: AuthSession;
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    vi.clearAllMocks();

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

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: '/tmp/test-project',
      },
    });

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: '/tmp/test-project/.worktrees/test-session',
        branch_name: 'claude-work/test-session',
      },
    });
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
  });

  it('PRが正常に作成され、201とpr_urlを返す', async () => {
    // git push と gh pr create をモック（encoding: utf-8 なので文字列を返す）
    mockExecSync
      .mockReturnValueOnce('Everything up-to-date') // git push
      .mockReturnValueOnce('https://github.com/owner/repo/pull/123\n'); // gh pr create

    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.pr_url).toBe('https://github.com/owner/repo/pull/123');
  });

  it('gh pr createコマンドが正しい引数で呼ばれる', async () => {
    mockExecSync
      .mockReturnValueOnce('') // git push
      .mockReturnValueOnce('https://github.com/owner/repo/pull/123\n'); // gh pr create

    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    await POST(request, { params: Promise.resolve({ id: session.id }) });

    // git push が呼ばれたことを確認
    expect(mockExecSync).toHaveBeenCalledWith(
      'git push -u origin claude-work/test-session',
      expect.objectContaining({
        cwd: '/tmp/test-project/.worktrees/test-session',
      })
    );

    // gh pr create が呼ばれたことを確認
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('gh pr create'),
      expect.objectContaining({
        cwd: '/tmp/test-project/.worktrees/test-session',
      })
    );
  });

  it('既存PRがある場合、400エラーを返す', async () => {
    mockExecSync
      .mockReturnValueOnce('') // git push
      .mockImplementationOnce(() => {
        throw new Error('a pull request for branch "test-branch" already exists');
      });

    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('PR作成に失敗しました');
    expect(data.details).toContain('既に存在します');
  });

  it('ghコマンドが失敗した場合、400エラーを返す', async () => {
    mockExecSync
      .mockReturnValueOnce('') // git push
      .mockImplementationOnce(() => {
        throw new Error('gh: not authenticated');
      });

    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('PR作成に失敗しました');
  });

  it('セッションが存在しない場合、404を返す', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/pr', {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('認証されていない場合、401を返す', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(401);
  });

  it('無効なセッションIDの場合、401を返す', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/pr`, {
      method: 'POST',
      headers: {
        cookie: `sessionId=invalid-session-id`,
      },
    });

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(401);
  });
});
