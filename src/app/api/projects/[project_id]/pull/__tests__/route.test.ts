import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import * as remoteRepoServiceModule from '@/services/remote-repo-service';

describe('POST /api/projects/[project_id]/pull', () => {
  let testDir: string;
  let sourceRepoPath: string;
  let clonedRepoPath: string;
  let testEnvId: string;

  beforeEach(async () => {
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();

    const env = db.insert(schema.executionEnvironments).values({
      name: 'Test Env',
      type: 'HOST',
      config: '{}',
    }).returning().get();
    testEnvId = env.id;

    // テスト用ディレクトリを作成
    testDir = mkdtempSync(join(tmpdir(), 'pull-test-'));

    // ソースリポジトリを作成
    sourceRepoPath = join(testDir, 'source-repo');
    mkdirSync(sourceRepoPath);
    execSync('git init', { cwd: sourceRepoPath });
    execSync('git config user.name "Test"', { cwd: sourceRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: sourceRepoPath });
    execSync('echo "initial" > README.md && git add . && git commit -m "initial"', {
      cwd: sourceRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: sourceRepoPath });

    // cloneリポジトリを作成
    clonedRepoPath = join(testDir, 'cloned-repo');
    execSync(`git clone ${sourceRepoPath} ${clonedRepoPath}`, { cwd: testDir });
  });

  afterEach(async () => {
    db.delete(schema.projects).run();
    db.delete(schema.executionEnvironments).run();
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should pull changes from remote', async () => {
    // プロジェクトを登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: clonedRepoPath,
      remote_url: sourceRepoPath,
      environment_id: testEnvId,
    }).returning().get();

    // environment_idが必須になったため、remoteRepoService.pullをモック
    const pullSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'pull')
      .mockResolvedValue({ success: true, updated: true, message: 'Updated' });

    try {
      const request = new NextRequest(
        `http://localhost:3000/api/projects/${project.id}/pull`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated).toBe(true);
    } finally {
      pullSpy.mockRestore();
    }
  });

  it('should return success with updated=false when already up to date', async () => {
    // プロジェクトを登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: clonedRepoPath,
      remote_url: sourceRepoPath,
      environment_id: testEnvId,
    }).returning().get();

    // environment_idが必須になったため、remoteRepoService.pullをモック
    const pullSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'pull')
      .mockResolvedValue({ success: true, updated: false, message: 'Already up to date' });

    try {
      const request = new NextRequest(
        `http://localhost:3000/api/projects/${project.id}/pull`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated).toBe(false);
    } finally {
      pullSpy.mockRestore();
    }
  });

  it('should return 404 for non-existent project', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/projects/non-existent-id/pull',
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: 'non-existent-id' }) });
    expect(response.status).toBe(404);
  });

  it('should return 400 for non-remote project', async () => {
    // ローカル登録のプロジェクト（remote_url がない）
    const project = db.insert(schema.projects).values({
      name: 'Local Project',
      path: sourceRepoPath,
      environment_id: testEnvId,
      // remote_url を設定しない
    }).returning().get();

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/pull`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('リモートから登録されていません');
  });

  it('should pass environment_id to RemoteRepoService when set', async () => {
    // 実行環境を作成
    const environment = db.insert(schema.executionEnvironments).values({
      name: 'Test Docker Environment',
      type: 'DOCKER',
      config: JSON.stringify({ imageName: 'node', imageTag: '20-alpine' }),
    }).returning().get();

    // プロジェクトを登録（environment_id付き）
    const project = db.insert(schema.projects).values({
      name: 'Test Project with Environment',
      path: clonedRepoPath,
      remote_url: sourceRepoPath,
      environment_id: environment.id,
    }).returning().get();

    // RemoteRepoService.pullをスパイ
    const pullSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'pull');

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/pull`,
      { method: 'POST' }
    );

    await POST(request, { params: Promise.resolve({ project_id: project.id }) });

    // environment_idが渡されたことを確認
    expect(pullSpy).toHaveBeenCalledWith(project.path, environment.id);

    pullSpy.mockRestore();
  });

  it('should call RemoteRepoService.pull with environment_id from project', async () => {
    // プロジェクトを登録（environment_idはNOT NULLのため常に必要）
    const project = db.insert(schema.projects).values({
      name: 'Test Project with Environment',
      path: clonedRepoPath,
      remote_url: sourceRepoPath,
      environment_id: testEnvId,
    }).returning().get();

    // RemoteRepoService.pullをスパイ
    const pullSpy = vi.spyOn(remoteRepoServiceModule.remoteRepoService, 'pull');

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/pull`,
      { method: 'POST' }
    );

    await POST(request, { params: Promise.resolve({ project_id: project.id }) });

    // environment_idが渡されることを確認（NOT NULL制約によりundefinedにはならない）
    expect(pullSpy).toHaveBeenCalledWith(project.path, testEnvId);

    pullSpy.mockRestore();
  });
});
