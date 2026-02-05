import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session } from '@/lib/db';

vi.mock('@/services/process-manager', () => ({
  ProcessManager: {
    getInstance: vi.fn().mockReturnValue({
      startClaudeCode: vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      }),
    }),
  },
}));

describe('POST /api/sessions/[id]/stop', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = db
      .insert(schema.projects)
      .values({
        name: 'Test Project',
        path: testRepoPath,
      })
      .returning()
      .get();

    session = db
      .insert(schema.sessions)
      .values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
      })
      .returning()
      .get();
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should stop session and return 200', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/stop`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('session');
    expect(data.session.id).toBe(session.id);
    expect(data.session.status).toBe('completed');

    const updatedSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, session.id),
    });
    expect(updatedSession?.status).toBe('completed');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/stop', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });
});
