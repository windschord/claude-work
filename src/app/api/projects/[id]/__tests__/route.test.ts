import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { AuthSession, Project } from '@prisma/client';

describe('PUT /api/projects/[id]', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

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

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });
  });

  afterEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should update project', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        name: 'Updated Project',
        default_model: 'opus',
      }),
    });

    const response = await PUT(request, { params: { id: project.id } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.name).toBe('Updated Project');
    expect(data.default_model).toBe('opus');

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(updated?.name).toBe('Updated Project');
    expect(updated?.default_model).toBe('opus');
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/non-existent-id', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: `sessionId=${authSession.id}`,
      },
      body: JSON.stringify({
        name: 'Updated Project',
      }),
    });

    const response = await PUT(request, { params: { id: 'non-existent-id' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Project',
      }),
    });

    const response = await PUT(request, { params: { id: project.id } });
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/projects/[id]', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

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

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });
  });

  afterEach(async () => {
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should delete project', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'DELETE',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await DELETE(request, { params: { id: project.id } });
    expect(response.status).toBe(204);

    const deleted = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(deleted).toBeNull();
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/non-existent-id', {
      method: 'DELETE',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await DELETE(request, { params: { id: 'non-existent-id' } });
    expect(response.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: { id: project.id } });
    expect(response.status).toBe(401);
  });
});
