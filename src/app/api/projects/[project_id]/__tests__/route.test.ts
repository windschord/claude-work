import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project } from '@prisma/client';

function createTempGitRepo(): string {
  const repoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
  execSync('git init', { cwd: repoPath });
  execSync('git config user.name "Test"', { cwd: repoPath });
  execSync('git config user.email "test@example.com"', { cwd: repoPath });
  writeFileSync(join(repoPath, 'README.md'), 'test');
  execSync('git add . && git commit -m "initial"', { cwd: repoPath, shell: true });
  execSync('git branch -M main', { cwd: repoPath });
  return repoPath;
}

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
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('project');
    expect(data.project).toHaveProperty('id');
    expect(data.project).toHaveProperty('name');
    expect(data.project).toHaveProperty('path');
    expect(data.project).toHaveProperty('created_at');
    expect(data.project).toHaveProperty('updated_at');
    expect(data.project.name).toBe('Updated Project');

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(updated?.name).toBe('Updated Project');
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

  describe('path update', () => {
    let newRepoPath: string;

    afterEach(() => {
      if (newRepoPath) {
        rmSync(newRepoPath, { recursive: true, force: true });
      }
    });

    it('should update path when new path is valid git repository', async () => {
      newRepoPath = createTempGitRepo();

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: newRepoPath }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.project.path).toBe(newRepoPath);

      const updated = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(updated?.path).toBe(newRepoPath);
    });

    it('should return 400 when new path is not a git repository', async () => {
      const notGitPath = mkdtempSync(join(tmpdir(), 'not-git-'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: notGitPath }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Git repository');

      rmSync(notGitPath, { recursive: true, force: true });
    });

    it('should return 400 when new path does not exist', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '/non/existent/path' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('not exist');
    });

    it('should return 409 when new path already used by another project', async () => {
      newRepoPath = createTempGitRepo();

      // Create another project with newRepoPath
      await prisma.project.create({
        data: {
          name: 'Another Project',
          path: newRepoPath,
        },
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: newRepoPath }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });

  describe('run_scripts update', () => {
    it('should create run_scripts when provided', async () => {
      const runScripts = [
        { name: 'build', command: 'npm run build', description: 'Build the project' },
        { name: 'test', command: 'npm test' },
      ];

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_scripts: runScripts }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.project.scripts).toHaveLength(2);
      expect(data.project.scripts[0].name).toBe('build');
      expect(data.project.scripts[0].command).toBe('npm run build');
      expect(data.project.scripts[0].description).toBe('Build the project');
      expect(data.project.scripts[1].name).toBe('test');
      expect(data.project.scripts[1].command).toBe('npm test');
      expect(data.project.scripts[1].description).toBeNull();

      const scripts = await prisma.runScript.findMany({
        where: { project_id: project.id },
      });
      expect(scripts).toHaveLength(2);
    });

    it('should replace existing run_scripts', async () => {
      // Create initial scripts
      await prisma.runScript.create({
        data: {
          project_id: project.id,
          name: 'old-script',
          command: 'old command',
        },
      });

      const newScripts = [
        { name: 'new-script', command: 'new command' },
      ];

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_scripts: newScripts }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const scripts = await prisma.runScript.findMany({
        where: { project_id: project.id },
      });
      expect(scripts).toHaveLength(1);
      expect(scripts[0].name).toBe('new-script');
    });

    it('should clear all run_scripts when empty array provided', async () => {
      // Create initial scripts
      await prisma.runScript.create({
        data: {
          project_id: project.id,
          name: 'to-delete',
          command: 'command',
        },
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_scripts: [] }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const scripts = await prisma.runScript.findMany({
        where: { project_id: project.id },
      });
      expect(scripts).toHaveLength(0);
    });

    it('should not modify run_scripts when not provided', async () => {
      // Create initial scripts
      await prisma.runScript.create({
        data: {
          project_id: project.id,
          name: 'existing',
          command: 'existing command',
        },
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const scripts = await prisma.runScript.findMany({
        where: { project_id: project.id },
      });
      expect(scripts).toHaveLength(1);
      expect(scripts[0].name).toBe('existing');
    });
  });

  describe('combined update', () => {
    let newRepoPath: string;

    afterEach(() => {
      if (newRepoPath) {
        rmSync(newRepoPath, { recursive: true, force: true });
      }
    });

    it('should update name, path, and run_scripts together', async () => {
      newRepoPath = createTempGitRepo();

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'New Name',
          path: newRepoPath,
          run_scripts: [{ name: 'script', command: 'cmd' }],
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.project.name).toBe('New Name');
      expect(data.project.path).toBe(newRepoPath);
      expect(data.project.scripts).toHaveLength(1);
    });
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
