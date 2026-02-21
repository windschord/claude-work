import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, PUT, DELETE, PATCH } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project } from '@/lib/db';

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

describe('GET /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-get-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();
  });

  afterEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return project', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('project');
    expect(data.project.id).toBe(project.id);
    expect(data.project.name).toBe('Test Project');
    expect(data.project.path).toBe(testRepoPath);
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/non-existent-id', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();
  });

  afterEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();
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

    const updated = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
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

      const updated = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
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
      db.insert(schema.projects).values({
        name: 'Another Project',
        path: newRepoPath,
      }).run();

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

      const scripts = db.select().from(schema.runScripts).where(eq(schema.runScripts.project_id, project.id)).all();
      expect(scripts).toHaveLength(2);
    });

    it('should replace existing run_scripts', async () => {
      // Create initial scripts
      db.insert(schema.runScripts).values({
        project_id: project.id,
        name: 'old-script',
        command: 'old command',
      }).run();

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

      const scripts = db.select().from(schema.runScripts).where(eq(schema.runScripts.project_id, project.id)).all();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].name).toBe('new-script');
    });

    it('should clear all run_scripts when empty array provided', async () => {
      // Create initial scripts
      db.insert(schema.runScripts).values({
        project_id: project.id,
        name: 'to-delete',
        command: 'command',
      }).run();

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_scripts: [] }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const scripts = db.select().from(schema.runScripts).where(eq(schema.runScripts.project_id, project.id)).all();
      expect(scripts).toHaveLength(0);
    });

    it('should not modify run_scripts when not provided', async () => {
      // Create initial scripts
      db.insert(schema.runScripts).values({
        project_id: project.id,
        name: 'existing',
        command: 'existing command',
      }).run();

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const scripts = db.select().from(schema.runScripts).where(eq(schema.runScripts.project_id, project.id)).all();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].name).toBe('existing');
    });
  });

  describe('claude_code_options and custom_env_vars', () => {
    it('should save claude_code_options as JSON string', async () => {
      const options = { model: 'claude-sonnet-4-5-20250929', permissionMode: 'plan' };
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claude_code_options: options }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const updated = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
      expect(updated?.claude_code_options).toBe(JSON.stringify(options));
    });

    it('should save custom_env_vars as JSON string', async () => {
      const envVars = { MY_VAR: 'value', OTHER: 'test' };
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ custom_env_vars: envVars }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const updated = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
      expect(updated?.custom_env_vars).toBe(JSON.stringify(envVars));
    });

    it('should keep existing options when not provided', async () => {
      // Set initial options
      db.update(schema.projects).set({
        claude_code_options: '{"model":"test"}',
      }).where(eq(schema.projects.id, project.id)).run();

      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const updated = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
      expect(updated?.claude_code_options).toBe('{"model":"test"}');
    });

    it('should return 400 for non-object claude_code_options', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claude_code_options: 'invalid' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
    });

    it('should return 400 for array claude_code_options', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claude_code_options: ['a', 'b'] }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
    });

    it('should return 400 for non-object custom_env_vars', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ custom_env_vars: 'invalid' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
    });

    it('should return 400 for custom_env_vars with non-string values', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ custom_env_vars: { VALID: 'ok', BAD: 123 } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
    });

    it('should return 400 for custom_env_vars with invalid key format', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ custom_env_vars: { lowercase: 'bad' } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
    });

    it('should return 400 for claude_code_options with non-string field', async () => {
      const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claude_code_options: { model: 123 } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(400);
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

describe('PATCH /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;
  let testEnvId: string;

  beforeEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-patch-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    // テスト用の実行環境を作成
    const testEnv = db.insert(schema.executionEnvironments).values({
      name: 'Test Env',
      type: 'DOCKER',
      config: '{}',
      is_default: false,
    }).returning().get();
    testEnvId = testEnv.id;

    project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
      environment_id: testEnvId,
    }).returning().get();
  });

  afterEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();
    db.run(sql`PRAGMA foreign_keys = OFF`);
    db.delete(schema.executionEnvironments).where(eq(schema.executionEnvironments.id, testEnvId)).run();
    db.run(sql`PRAGMA foreign_keys = ON`);
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('environment_idが送信されても無視される', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment_id: 'new-env-456' }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(200);

    const updated = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();
    expect(updated?.environment_id).toBe(testEnvId);
  });

  it('claude_code_optionsを正しく更新する', async () => {
    const options = { model: 'claude-sonnet-4-5-20250929', verbose: 'true' };
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claude_code_options: options }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(200);

    const updated = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();
    expect(JSON.parse(updated?.claude_code_options || '{}')).toEqual(options);
  });

  it('custom_env_varsを正しく更新する', async () => {
    const envVars = { MY_VAR: 'value1', OTHER_VAR: 'value2' };
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_env_vars: envVars }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(200);

    const updated = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();
    expect(JSON.parse(updated?.custom_env_vars || '{}')).toEqual(envVars);
  });

  it('claude_code_optionsとcustom_env_varsを同時に更新できる', async () => {
    const options = { model: 'claude-sonnet-4-5-20250929' };
    const envVars = { API_KEY: 'test-key' };
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude_code_options: options,
        custom_env_vars: envVars,
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(200);

    const updated = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();
    expect(JSON.parse(updated?.claude_code_options || '{}')).toEqual(options);
    expect(JSON.parse(updated?.custom_env_vars || '{}')).toEqual(envVars);
  });

  it('claude_code_optionsがオブジェクトでない場合は400エラー', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claude_code_options: 'invalid' }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(400);
  });

  it('custom_env_varsのキーが不正な形式の場合は400エラー', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_env_vars: { 'invalid-key': 'value' } }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(400);
  });

  it('存在しないプロジェクトの場合は404エラー', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claude_code_options: {} }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
  });

  it('空のボディでもエラーにならない', async () => {
    const request = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ project_id: project.id }),
    });

    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/projects/[project_id]', () => {
  let testRepoPath: string;
  let project: Project;

  beforeEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();
  });

  afterEach(async () => {
    db.delete(schema.runScripts).run();
    db.delete(schema.projects).run();
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

    const deleted = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
    expect(deleted).toBeUndefined();
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/non-existent-id', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });
});
