/**
 * POST /api/sessions/[id]/resume テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// モジュールのモック
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/process-lifecycle-manager', () => ({
  getProcessLifecycleManager: vi.fn(() => ({
    resumeSession: vi.fn().mockResolvedValue({ pid: 12345 }),
  })),
}));

import { POST } from '../route';
import { prisma } from '@/lib/db';
import { getProcessLifecycleManager } from '@/services/process-lifecycle-manager';

describe('POST /api/sessions/[id]/resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = () => {
    return new NextRequest('http://localhost:3000/api/sessions/session-123/resume', {
      method: 'POST',
    });
  };

  it('セッションが見つからない場合は404を返すべき', async () => {
    const request = createMockRequest();
    const params = Promise.resolve({ id: 'nonexistent-session' });

    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('stopped以外のステータスの場合は400を返すべき', async () => {
    const request = createMockRequest();
    const params = Promise.resolve({ id: 'session-123' });

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'running', // stopped以外
      model: 'sonnet',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: null,
      last_activity_at: null,
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Session is not stopped');
  });

  it('stopped状態のセッションを正常に再開できるべき', async () => {
    const request = createMockRequest();
    const params = Promise.resolve({ id: 'session-123' });

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'stopped',
      model: 'sonnet',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: null,
      last_activity_at: null,
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    vi.mocked(prisma.session.update).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'running',
      model: 'sonnet',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: null,
      last_activity_at: new Date(),
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session.status).toBe('running');
  });

  it('resume_session_idがある場合、resumeSessionに渡されるべき', async () => {
    const request = createMockRequest();
    const params = Promise.resolve({ id: 'session-123' });
    const mockResumeSession = vi.fn().mockResolvedValue({ pid: 12345 });

    vi.mocked(getProcessLifecycleManager).mockReturnValue({
      resumeSession: mockResumeSession,
    } as ReturnType<typeof getProcessLifecycleManager>);

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'stopped',
      model: 'opus',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: 'claude-session-abc123',
      last_activity_at: null,
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    vi.mocked(prisma.session.update).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'running',
      model: 'opus',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: 'claude-session-abc123',
      last_activity_at: new Date(),
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await POST(request, { params });

    expect(mockResumeSession).toHaveBeenCalledWith(
      'session-123',
      '/path/to/worktree',
      'opus',
      'claude-session-abc123'
    );
  });

  it('プロセス起動失敗時は500を返すべき', async () => {
    const request = createMockRequest();
    const params = Promise.resolve({ id: 'session-123' });
    const mockResumeSession = vi.fn().mockRejectedValue(new Error('Process start failed'));

    vi.mocked(getProcessLifecycleManager).mockReturnValue({
      resumeSession: mockResumeSession,
    } as ReturnType<typeof getProcessLifecycleManager>);

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'session-123',
      project_id: 'project-1',
      name: 'Test Session',
      status: 'stopped',
      model: 'sonnet',
      worktree_path: '/path/to/worktree',
      branch_name: 'feature/test',
      resume_session_id: null,
      last_activity_at: null,
      pr_url: null,
      pr_number: null,
      pr_status: null,
      pr_updated_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to resume session');
  });
});
