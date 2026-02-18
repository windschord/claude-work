import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import * as remoteRepoServiceModule from '@/services/remote-repo-service';

describe('GET /api/projects/[project_id]/branches', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();

    // テスト用の環境を作成
    db.insert(schema.executionEnvironments).values({
      id: 'docker-env-123',
      name: 'Test Docker Env',
      type: 'DOCKER',
      description: 'Test environment',
      config: '{}',
      is_default: false,
    }).run();

    // テスト用のGitリポジトリを作成
    testRepoPath = mkdtempSync(join(tmpdir(), 'branches-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });
    // 追加ブランチを作成
    execSync('git checkout -b develop', { cwd: testRepoPath });
    execSync('echo "develop" > develop.md && git add . && git commit -m "develop"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git checkout main', { cwd: testRepoPath });
  });

  afterEach(async () => {
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('should return branches for a project', async () => {
    // プロジェクトを登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/branches`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.branches).toBeDefined();
    expect(Array.isArray(data.branches)).toBe(true);
    expect(data.branches.length).toBeGreaterThan(0);

    // mainブランチが含まれているか確認
    const mainBranch = data.branches.find((b: { name: string }) => b.name === 'main');
    expect(mainBranch).toBeDefined();
    expect(mainBranch.isDefault).toBe(true);

    // developブランチが含まれているか確認
    const developBranch = data.branches.find((b: { name: string }) => b.name === 'develop');
    expect(developBranch).toBeDefined();
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent-id/branches',
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });

  it('should include isRemote flag for branches', async () => {
    // プロジェクトを登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/branches`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();

    // 各ブランチにisRemoteフラグがあることを確認
    for (const branch of data.branches) {
      expect(typeof branch.isRemote).toBe('boolean');
    }

    // ローカルブランチはisRemote=false
    const localBranches = data.branches.filter((b: { isRemote: boolean }) => !b.isRemote);
    expect(localBranches.length).toBeGreaterThan(0);
  });

  it('should call getBranches with environmentId when project has one', async () => {
    // プロジェクトをenvironment_idつきで登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
      environment_id: 'docker-env-123',
    }).returning().get();

    // getBranchesメソッドをスパイ
    const getBranchesSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'getBranches');

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/branches`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    // environmentIdが渡されていることを確認
    expect(getBranchesSpy).toHaveBeenCalledWith(testRepoPath, 'docker-env-123');

    getBranchesSpy.mockRestore();
  });

  it('should call getBranches without environmentId when project does not have one', async () => {
    // プロジェクトをenvironment_idなしで登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: testRepoPath,
    }).returning().get();

    // getBranchesメソッドをスパイ
    const getBranchesSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'getBranches');

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/branches`,
      { method: 'GET' }
    );

    const response = await GET(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    // environmentIdがundefinedで渡されることを確認
    expect(getBranchesSpy).toHaveBeenCalledWith(testRepoPath, undefined);

    getBranchesSpy.mockRestore();
  });
});
