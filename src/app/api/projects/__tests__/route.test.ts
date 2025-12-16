import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession } from '@prisma/client';

describe('GET /api/projects', () => {
  let testRepoPath: string;
  let authSession: AuthSession;

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();

    authSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        token_hash: 'test-hash',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });
  });

  afterEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return 200 and list of projects', async () => {
    await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/projects', {
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('projects');
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Test Project');
    expect(data.projects[0].path).toBe(testRepoPath);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects');

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return response in {projects: [...]} format when projects exist', async () => {
    await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/projects', {
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('projects');
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Test Project');
    expect(data.projects[0].path).toBe(testRepoPath);
  });

  it('should return {projects: []} format when no projects exist', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects', {
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('projects');
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects).toHaveLength(0);
  });
});

describe('POST /api/projects', () => {
  let testRepoPath: string;
  let authSession: AuthSession;

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();

    authSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        token_hash: 'test-hash',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });
  });

  afterEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should create project with valid git repository', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        path: testRepoPath,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.path).toBe(testRepoPath);
    expect(data.name).toBeTruthy();

    const project = await prisma.project.findFirst({
      where: { path: testRepoPath },
    });
    expect(project).toBeTruthy();
  });

  it('should return 400 for invalid git repository', async () => {
    const invalidPath = mkdtempSync(join(tmpdir(), 'invalid-'));

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        path: invalidPath,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    rmSync(invalidPath, { recursive: true, force: true });
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        path: testRepoPath,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 409 when adding duplicate project path', async () => {
    // 最初のプロジェクト作成
    const firstRequest = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        path: testRepoPath,
      }),
    });

    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(201);

    // 同じパスで再度プロジェクト作成を試みる
    const secondRequest = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        path: testRepoPath,
      }),
    });

    const secondResponse = await POST(secondRequest);
    expect(secondResponse.status).toBe(409);

    const data = await secondResponse.json();
    expect(data.error).toBe('このパスは既に登録されています');
  });

  describe('ALLOWED_PROJECT_DIRS validation', () => {
    let originalAllowedDirs: string | undefined;

    beforeEach(() => {
      originalAllowedDirs = process.env.ALLOWED_PROJECT_DIRS;
    });

    afterEach(() => {
      if (originalAllowedDirs === undefined) {
        delete process.env.ALLOWED_PROJECT_DIRS;
      } else {
        process.env.ALLOWED_PROJECT_DIRS = originalAllowedDirs;
      }
    });

    it('should allow all paths when ALLOWED_PROJECT_DIRS is empty string', async () => {
      process.env.ALLOWED_PROJECT_DIRS = '';

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          path: testRepoPath,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('should allow all paths when ALLOWED_PROJECT_DIRS is not set', async () => {
      delete process.env.ALLOWED_PROJECT_DIRS;

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          path: testRepoPath,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('should allow only specified paths when ALLOWED_PROJECT_DIRS is set', async () => {
      const allowedPath = mkdtempSync(join(tmpdir(), 'allowed-'));
      execSync('git init', { cwd: allowedPath });
      execSync('git config user.name "Test"', { cwd: allowedPath });
      execSync('git config user.email "test@example.com"', { cwd: allowedPath });
      execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
        cwd: allowedPath,
        shell: true,
      });

      const parentDir = join(allowedPath, '..');
      process.env.ALLOWED_PROJECT_DIRS = parentDir;

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          path: allowedPath,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      rmSync(allowedPath, { recursive: true, force: true });
    });

    it('should return 403 for disallowed paths', async () => {
      const allowedPath = mkdtempSync(join(tmpdir(), 'allowed-'));
      const disallowedPath = mkdtempSync(join(tmpdir(), 'disallowed-'));
      execSync('git init', { cwd: disallowedPath });
      execSync('git config user.name "Test"', { cwd: disallowedPath });
      execSync('git config user.email "test@example.com"', { cwd: disallowedPath });
      execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
        cwd: disallowedPath,
        shell: true,
      });

      process.env.ALLOWED_PROJECT_DIRS = allowedPath;

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          path: disallowedPath,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBeTruthy();

      rmSync(allowedPath, { recursive: true, force: true });
      rmSync(disallowedPath, { recursive: true, force: true });
    });
  });
});
