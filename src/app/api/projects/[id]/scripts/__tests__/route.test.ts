import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project } from '@prisma/client';

describe('GET /api/projects/[id]/scripts', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

  beforeEach(async () => {
    await prisma.runScript.deleteMany();
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
    execSync('git init', { cwd: testRepoPath, timeout: 10000 });
    execSync('git config user.name "Test"', { cwd: testRepoPath, timeout: 10000 });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, timeout: 10000 });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
      timeout: 10000,
    });
    execSync('git branch -M main', { cwd: testRepoPath, timeout: 10000 });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });
  });

  afterEach(async () => {
    await prisma.runScript.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return 200 and list of run scripts', async () => {
    await prisma.runScript.createMany({
      data: [
        {
          project_id: project.id,
          name: 'Test',
          description: 'Run unit tests',
          command: 'npm test',
        },
        {
          project_id: project.id,
          name: 'Build',
          description: 'Build the project',
          command: 'npm run build',
        },
      ],
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: project.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Test');
    expect(data[0].command).toBe('npm test');
    expect(data[1].name).toBe('Build');
  });

  it('should return empty array when no scripts exist', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, { params: { id: project.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`
    );

    const response = await GET(request, { params: { id: project.id } });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/projects/[id]/scripts', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

  beforeEach(async () => {
    await prisma.runScript.deleteMany();
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
    execSync('git init', { cwd: testRepoPath, timeout: 10000 });
    execSync('git config user.name "Test"', { cwd: testRepoPath, timeout: 10000 });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, timeout: 10000 });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
      timeout: 10000,
    });
    execSync('git branch -M main', { cwd: testRepoPath, timeout: 10000 });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });
  });

  afterEach(async () => {
    await prisma.runScript.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should create run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test',
          description: 'Run unit tests',
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, { params: { id: project.id } });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.name).toBe('Test');
    expect(data.description).toBe('Run unit tests');
    expect(data.command).toBe('npm test');
    expect(data.project_id).toBe(project.id);

    const script = await prisma.runScript.findFirst({
      where: { project_id: project.id },
    });
    expect(script).toBeTruthy();
    expect(script?.name).toBe('Test');
  });

  it('should create run script without description', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Build',
          command: 'npm run build',
        }),
      }
    );

    const response = await POST(request, { params: { id: project.id } });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.name).toBe('Build');
    expect(data.description).toBeNull();
    expect(data.command).toBe('npm run build');
  });

  it('should return 400 if name is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, { params: { id: project.id } });
    expect(response.status).toBe(400);
  });

  it('should return 400 if command is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test',
        }),
      }
    );

    const response = await POST(request, { params: { id: project.id } });
    expect(response.status).toBe(400);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, { params: { id: project.id } });
    expect(response.status).toBe(401);
  });
});
