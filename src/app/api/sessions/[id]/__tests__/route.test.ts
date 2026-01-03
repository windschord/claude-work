import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, DELETE, PATCH } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session } from '@prisma/client';

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

describe('GET /api/sessions/[id]', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

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

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
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

  it('should return 200 and session details', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`);

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('session');
    expect(data.session.id).toBe(session.id);
    expect(data.session.name).toBe('Test Session');
    expect(data.session.status).toBe('running');
    expect(data.session.project_id).toBe(project.id);
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent');

    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/sessions/[id]', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

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

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
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

  it('should delete session and return 204', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(204);

    const deletedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(deletedSession).toBeNull();
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/sessions/[id]', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

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

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Original Name',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
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

  it('should update session name and return 200', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('session');
    expect(data.session.name).toBe('Updated Name');

    const updatedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.name).toBe('Updated Name');
  });

  it('should return 400 for empty name', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Name is required');
  });

  it('should return 400 for whitespace-only name', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Name is required');
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('should trim whitespace from name', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '  Trimmed Name  ' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.session.name).toBe('Trimmed Name');
  });
});
