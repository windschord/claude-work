import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project } from '@prisma/client';

describe('PUT /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
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
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should update project', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Project',
        default_model: 'opus',
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('project');
    expect(data.project).toHaveProperty('id');
    expect(data.project).toHaveProperty('name');
    expect(data.project).toHaveProperty('path');
    expect(data.project).toHaveProperty('default_model');
    expect(data.project).toHaveProperty('created_at');
    expect(data.project).toHaveProperty('updated_at');
    expect(data.project.name).toBe('Updated Project');
    expect(data.project.default_model).toBe('opus');

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
      },
      body: JSON.stringify({
        name: 'Updated Project',
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
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
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should delete project', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(204);

    const deleted = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(deleted).toBeNull();
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/non-existent-id', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });
});
