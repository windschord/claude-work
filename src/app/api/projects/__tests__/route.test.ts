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
      shell: '/bin/bash',
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
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Test Project');
    expect(data[0].path).toBe(testRepoPath);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects');

    const response = await GET(request);
    expect(response.status).toBe(401);
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
      shell: '/bin/bash',
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
});
