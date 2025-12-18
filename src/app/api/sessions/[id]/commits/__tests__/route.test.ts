import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';

vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/services/git-service');

describe('GET /api/sessions/{id}/commits', () => {
  const mockSessionId = 'mock-session-id';
  const mockProjectPath = '/path/to/project';
  const mockWorktreePath = '/path/to/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('認証されていない場合は401を返す', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: 'sessionId=invalid' },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('セッションが見つからない場合は404を返す', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: mockSessionId,
      token_hash: 'hash',
      expires_at: new Date(),
      created_at: new Date(),
    });

    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: `sessionId=${mockSessionId}` },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Session not found' });
  });

  it('コミット履歴を統一形式で返す', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: mockSessionId,
      token_hash: 'hash',
      expires_at: new Date(),
      created_at: new Date(),
    });

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'test-id',
      project_id: 'project-1',
      name: 'feature-branch',
      status: 'active',
      model: 'sonnet',
      worktree_path: mockWorktreePath,
      branch_name: 'session/feature-branch',
      created_at: new Date(),
      project: {
        id: 'project-1',
        name: 'test-project',
        path: mockProjectPath,
        created_at: new Date(),
        updated_at: new Date(),
      },
    } as any);

    const mockCommits = [
      {
        hash: 'abc123def456',
        short_hash: 'abc123d',
        message: 'Add authentication',
        author: 'Claude',
        date: '2025-12-08T10:05:00Z',
        files_changed: 3,
      },
      {
        hash: 'def456ghi789',
        short_hash: 'def456g',
        message: 'Fix bug in login',
        author: 'Claude',
        date: '2025-12-08T11:00:00Z',
        files_changed: 1,
      },
    ];

    const mockGitService = {
      getCommits: vi.fn().mockReturnValue(mockCommits),
    };
    vi.mocked(GitService).mockImplementation(() => mockGitService as any);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: `sessionId=${mockSessionId}` },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ commits: mockCommits });
    expect(mockGitService.getCommits).toHaveBeenCalledWith('feature-branch');
  });
});
