import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import type { Project, Session } from '@/lib/db';

const { mockStop, mockGetStatus } = vi.hoisted(() => ({
  mockStop: vi.fn().mockResolvedValue(undefined),
  mockGetStatus: vi.fn(),
}));

vi.mock('@/services/run-script-manager', () => ({
  RunScriptManager: class {
    static getInstance = vi.fn().mockReturnValue({
      runScript: vi.fn().mockResolvedValue('test-run-id'),
      stop: mockStop,
      getStatus: mockGetStatus,
    });
  },
}));

describe('POST /api/sessions/[id]/run/[run_id]/stop', () => {
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    vi.clearAllMocks();

    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();

    const env = db.insert(schema.executionEnvironments).values({
      name: 'Test Env',
      type: 'HOST',
      config: '{}',
    }).returning().get();

    project = db
      .insert(schema.projects)
      .values({
        name: 'Test Project',
        path: '/tmp/fake-repo-path',
        clone_location: 'host',
        environment_id: env.id,
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

    // Setup default mock behavior
    mockGetStatus.mockReturnValue({
      runId: 'test-run-id',
      sessionId: session.id,
      command: 'npm test',
      pid: 12345,
      status: 'running',
    });
  });

  it('should stop running script and return 200', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run/test-run-id/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: session.id, run_id: 'test-run-id' }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(mockStop).toHaveBeenCalledWith('test-run-id');
  });

  it('should return 404 if session not found', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/sessions/non-existent/run/test-run-id/stop',
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'non-existent', run_id: 'test-run-id' }),
    });
    expect(response.status).toBe(404);
  });

  it('should return 404 if run_id not found', async () => {
    mockGetStatus.mockReturnValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/run/non-existent-run-id/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: session.id, run_id: 'non-existent-run-id' }),
    });
    expect(response.status).toBe(404);
  });
});
