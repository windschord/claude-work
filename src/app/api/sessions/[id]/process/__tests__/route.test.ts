import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session, ExecutionEnvironment } from '@/lib/db';

vi.mock('@/services/process-manager', () => {
  const mockHasProcess = vi.fn();
  const mockStartClaudeCode = vi.fn();
  return {
    ProcessManager: {
      getInstance: vi.fn(() => ({
        hasProcess: mockHasProcess,
        startClaudeCode: mockStartClaudeCode,
      })),
    },
    mockHasProcess,
    mockStartClaudeCode,
  };
});

vi.mock('@/services/adapter-factory', () => {
  const mockGetAdapter = vi.fn();
  return {
    AdapterFactory: {
      getAdapter: mockGetAdapter,
    },
    mockGetAdapter,
  };
});

const { mockHasProcess, mockStartClaudeCode } = await import('@/services/process-manager') as {
  mockHasProcess: ReturnType<typeof vi.fn>;
  mockStartClaudeCode: ReturnType<typeof vi.fn>;
};

const { mockGetAdapter } = await import('@/services/adapter-factory') as {
  mockGetAdapter: ReturnType<typeof vi.fn>;
};

describe('GET /api/sessions/[id]/process', () => {
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

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return { running: true } when process is running', async () => {
    mockHasProcess.mockReturnValue(true);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: true });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
  });

  it('should return { running: false } when process is not running', async () => {
    mockHasProcess.mockReturnValue(false);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: false });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/process', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ error: 'Session not found' });
  });
});

describe('POST /api/sessions/[id]/process', () => {
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

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should start process and return { success: true, running: true }', async () => {
    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockResolvedValue({
      sessionId: session.id,
      pid: 12345,
      status: 'running',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
    expect(mockStartClaudeCode).toHaveBeenCalledWith({
      sessionId: session.id,
      worktreePath: session.worktree_path,
    });
  });

  it('should update session status to running in database after starting process', async () => {
    // セッションのステータスを 'stopped' に設定
    db.update(schema.sessions)
      .set({ status: 'stopped' })
      .where(eq(schema.sessions.id, session.id))
      .run();

    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockResolvedValue({
      sessionId: session.id,
      pid: 12345,
      status: 'running',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    // データベースのセッションステータスが 'running' に更新されていることを確認
    const updatedSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, session.id),
    });
    expect(updatedSession?.status).toBe('running');
  });

  it('should update last_activity_at after starting process', async () => {
    // SQLiteは秒精度なので、テスト開始1秒前から比較
    const beforeTime = new Date(Date.now() - 1000);

    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockResolvedValue({
      sessionId: session.id,
      pid: 12345,
      status: 'running',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    await POST(request, { params: Promise.resolve({ id: session.id }) });

    // last_activity_at が更新されていることを確認
    const updatedSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, session.id),
    });
    expect(updatedSession?.last_activity_at).not.toBeNull();
    expect(new Date(updatedSession!.last_activity_at!).getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
  });

  it('should return { success: true, running: true, message: "Process already running" } when process is already running', async () => {
    mockHasProcess.mockReturnValue(true);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true, message: 'Process already running' });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
    expect(mockStartClaudeCode).not.toHaveBeenCalled();
  });

  it('should return 500 when process fails to start', async () => {
    mockHasProcess.mockReturnValue(false);
    mockStartClaudeCode.mockRejectedValue(new Error('Failed to start process'));

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/process', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ error: 'Session not found' });
  });
});

describe('GET /api/sessions/[id]/process with environment_id', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;
  let environment: ExecutionEnvironment;

  beforeEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-env-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    // Docker環境を作成
    environment = db
      .insert(schema.executionEnvironments)
      .values({
        name: 'Test Docker',
        type: 'DOCKER',
        config: '{}',
        auth_dir_path: '/tmp/auth',
      })
      .returning()
      .get();

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
        name: 'Test Session with Env',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
        environment_id: environment.id,
      })
      .returning()
      .get();

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
    mockGetAdapter.mockReset();
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return { running: true } when adapter.hasSession() returns true', async () => {
    const mockAdapter = { hasSession: vi.fn().mockReturnValue(true) };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: true });
    expect(mockGetAdapter).toHaveBeenCalled();
    expect(mockAdapter.hasSession).toHaveBeenCalledWith(session.id);
    expect(mockHasProcess).not.toHaveBeenCalled();
  });

  it('should return { running: false } when adapter.hasSession() returns false', async () => {
    const mockAdapter = { hasSession: vi.fn().mockReturnValue(false) };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: false });
  });

  it('should fall back to ProcessManager when adapter throws error', async () => {
    mockGetAdapter.mockImplementation(() => {
      throw new Error('Adapter error');
    });
    mockHasProcess.mockReturnValue(true);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ running: true });
    expect(mockHasProcess).toHaveBeenCalledWith(session.id);
  });
});

describe('POST /api/sessions/[id]/process with environment_id', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;
  let environment: ExecutionEnvironment;

  beforeEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-env-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    // Docker環境を作成
    environment = db
      .insert(schema.executionEnvironments)
      .values({
        name: 'Test Docker',
        type: 'DOCKER',
        config: '{}',
        auth_dir_path: '/tmp/auth',
      })
      .returning()
      .get();

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
        name: 'Test Session with Env',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
        environment_id: environment.id,
        resume_session_id: 'resume-session-123',
      })
      .returning()
      .get();

    mockHasProcess.mockReset();
    mockStartClaudeCode.mockReset();
    mockGetAdapter.mockReset();
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return early if process already running via adapter', async () => {
    const mockAdapter = { hasSession: vi.fn().mockReturnValue(true) };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true, message: 'Process already running' });
  });

  it('should start process via adapter.createSession() when not running', async () => {
    const mockAdapter = {
      hasSession: vi.fn().mockReturnValue(false),
      createSession: vi.fn().mockResolvedValue(undefined),
    };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true, running: true });
    expect(mockAdapter.createSession).toHaveBeenCalledWith(
      session.id,
      session.worktree_path,
      undefined,
      { resumeSessionId: 'resume-session-123' }
    );
    expect(mockStartClaudeCode).not.toHaveBeenCalled();
  });

  it('should update session status to running after starting via adapter', async () => {
    // セッションのステータスを 'stopped' に設定
    db.update(schema.sessions)
      .set({ status: 'stopped' })
      .where(eq(schema.sessions.id, session.id))
      .run();

    const mockAdapter = {
      hasSession: vi.fn().mockReturnValue(false),
      createSession: vi.fn().mockResolvedValue(undefined),
    };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/process`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    // データベースのセッションステータスが 'running' に更新されていることを確認
    const updatedSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, session.id),
    });
    expect(updatedSession?.status).toBe('running');
  });
});
