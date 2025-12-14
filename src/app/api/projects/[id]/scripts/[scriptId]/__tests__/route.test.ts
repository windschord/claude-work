import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project, RunScript } from '@prisma/client';

// 共通テストセットアップ
let testRepoPath: string;
let authSession: AuthSession;
let project: Project;
let script: RunScript;

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

  script = await prisma.runScript.create({
    data: {
      project_id: project.id,
      name: 'Test',
      description: 'Run unit tests',
      command: 'npm test',
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

describe('PUT /api/projects/[id]/scripts/[scriptId]', () => {

  it('should update run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test Updated',
          description: 'Run all tests',
          command: 'npm run test:all',
        }),
      }
    );

    const response = await PUT(request, {
      params: { id: project.id, scriptId: script.id },
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.name).toBe('Test Updated');
    expect(data.description).toBe('Run all tests');
    expect(data.command).toBe('npm run test:all');

    const updatedScript = await prisma.runScript.findUnique({
      where: { id: script.id },
    });
    expect(updatedScript?.name).toBe('Test Updated');
  });

  it('should update only specified fields', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test Updated',
        }),
      }
    );

    const response = await PUT(request, {
      params: { id: project.id, scriptId: script.id },
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.name).toBe('Test Updated');
    expect(data.description).toBe('Run unit tests');
    expect(data.command).toBe('npm test');
  });

  it('should return 404 if script not found', async () => {
    const fakeId = randomUUID();
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${fakeId}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test Updated',
        }),
      }
    );

    const response = await PUT(request, {
      params: { id: project.id, scriptId: fakeId },
    });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Updated',
        }),
      }
    );

    const response = await PUT(request, {
      params: { id: project.id, scriptId: script.id },
    });
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/projects/[id]/scripts/[scriptId]', () => {

  it('should delete run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'DELETE',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await DELETE(request, {
      params: { id: project.id, scriptId: script.id },
    });
    expect(response.status).toBe(204);

    const deletedScript = await prisma.runScript.findUnique({
      where: { id: script.id },
    });
    expect(deletedScript).toBeNull();
  });

  it('should return 404 if script not found', async () => {
    const fakeId = randomUUID();
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${fakeId}`,
      {
        method: 'DELETE',
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await DELETE(request, {
      params: { id: project.id, scriptId: fakeId },
    });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, {
      params: { id: project.id, scriptId: script.id },
    });
    expect(response.status).toBe(401);
  });
});
