import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project } from '@prisma/client';

vi.mock('@/services/process-manager', () => ({
  ProcessManager: {
    getInstance: vi.fn(() => ({
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
    })),
  },
}));

describe('GET /api/projects/[project_id]/sessions', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-test-'));
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
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return 200 and list of sessions for a project', async () => {
    await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        model: 'sonnet',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('sessions');
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].name).toBe('Test Session');
    expect(data.sessions[0].project_id).toBe(project.id);
  });
});

describe('POST /api/projects/[project_id]/sessions', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'session-test-'));
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
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should create session with worktree', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'test prompt',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('session');
    expect(data.session.name).toBe('New Session');
    expect(data.session.project_id).toBe(project.id);
    expect(data.session.status).toBe('initializing');
    expect(data.session.worktree_path).toBeTruthy();
    expect(data.session.branch_name).toBeTruthy();

    const session = await prisma.session.findFirst({
      where: { project_id: project.id },
    });
    expect(session).toBeTruthy();
  });

  it('should return response in { session: {...} } format', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Response Format',
          prompt: 'test prompt',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    const data = await response.json();

    // レスポンス形式の検証
    expect(data).toHaveProperty('session');
    expect(typeof data.session).toBe('object');

    // sessionオブジェクトのフィールド検証
    expect(data.session).toHaveProperty('id');
    expect(data.session).toHaveProperty('project_id');
    expect(data.session).toHaveProperty('name');
    expect(data.session).toHaveProperty('status');
    expect(data.session).toHaveProperty('model');
    expect(data.session).toHaveProperty('worktree_path');
    expect(data.session).toHaveProperty('branch_name');
    expect(data.session).toHaveProperty('created_at');

    // 値の検証
    expect(data.session.project_id).toBe(project.id);
    expect(data.session.name).toBe('Test Response Format');
    expect(data.session.status).toBe('initializing');
    expect(data.session.model).toBe('sonnet');
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent/sessions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'test prompt',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('should auto-generate session name if name is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'test prompt',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.session).toBeTruthy();
    // 自動生成された名前は「形容詞-動物名」形式
    expect(data.session.name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('should create session without prompt (prompt is optional)', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'No Prompt Session',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.session).toBeTruthy();
    expect(data.session.name).toBe('No Prompt Session');
  });

  it('should create session with empty prompt', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Empty Prompt Session',
          prompt: '',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.session).toBeTruthy();
    expect(data.session.name).toBe('Empty Prompt Session');
  });

  it('should still work with prompt provided (backward compatibility)', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'With Prompt Session',
          prompt: 'test prompt for backward compatibility',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.session).toBeTruthy();
    expect(data.session.name).toBe('With Prompt Session');
  });

  it('should save prompt to Prompt table when creating session', async () => {
    await prisma.prompt.deleteMany();

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'Implement user authentication',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    // プロンプトが保存されたか確認
    const savedPrompt = await prisma.prompt.findFirst({
      where: { content: 'Implement user authentication' },
    });
    expect(savedPrompt).toBeTruthy();
    expect(savedPrompt?.used_count).toBe(1);
    expect(savedPrompt?.last_used_at).toBeTruthy();
  });

  it('should increment used_count if prompt already exists', async () => {
    await prisma.prompt.deleteMany();

    // 既存のプロンプトを作成
    const existingPrompt = await prisma.prompt.create({
      data: {
        content: 'Fix bug in authentication',
        used_count: 3,
        last_used_at: new Date('2025-12-10T10:00:00Z'),
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          prompt: 'Fix bug in authentication',
          model: 'sonnet',
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(201);

    // used_countがインクリメントされたか確認
    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: existingPrompt.id },
    });
    expect(updatedPrompt?.used_count).toBe(4);
    expect(updatedPrompt?.last_used_at.getTime()).toBeGreaterThan(
      existingPrompt.last_used_at.getTime()
    );
  });
});
