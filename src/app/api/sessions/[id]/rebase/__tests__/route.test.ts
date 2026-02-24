import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import type { Project, Session } from '@/lib/db';

const { mockRebaseFromMain } = vi.hoisted(() => ({
  mockRebaseFromMain: vi.fn(),
}));

vi.mock('@/services/git-service', () => ({
  GitService: class MockGitService {
    rebaseFromMain = mockRebaseFromMain;
  },
}));

vi.mock('@/services/docker-git-service', () => ({
  DockerGitService: class MockDockerGitService {
    rebaseFromMain = vi.fn();
  },
}));

describe('POST /api/sessions/[id]/rebase', () => {
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    vi.clearAllMocks();

    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();

    project = db
      .insert(schema.projects)
      .values({
        name: 'Test Project',
        path: '/tmp/fake-repo-path', clone_location: 'host',
      })
      .returning()
      .get();

    session = db
      .insert(schema.sessions)
      .values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/tmp/fake-repo-path/.worktrees/test-session',
        branch_name: 'test-branch',
      })
      .returning()
      .get();
  });

  it('should rebase successfully and return 200', async () => {
    mockRebaseFromMain.mockReturnValue({ success: true });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/rebase`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.conflicts).toBeUndefined();
    expect(mockRebaseFromMain).toHaveBeenCalledWith('test-session');
  });

  it('should return 409 with conflict files when rebase has conflicts', async () => {
    mockRebaseFromMain.mockReturnValue({
      success: false,
      conflicts: ['README.md'],
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/rebase`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.conflicts).toContain('README.md');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/rebase', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });
});
