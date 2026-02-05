import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

describe('POST /api/projects/[project_id]/pull', () => {
  let testDir: string;
  let sourceRepoPath: string;
  let clonedRepoPath: string;

  beforeEach(async () => {
    db.delete(schema.projects).run();

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
    }).returning().get();

    // ソースリポジトリに変更を加える
    execSync('echo "updated" > new-file.md && git add . && git commit -m "new commit"', {
      cwd: sourceRepoPath,
      shell: true,
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/pull`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.updated).toBe(true);
  });

  it('should return success with updated=false when already up to date', async () => {
    // プロジェクトを登録
    const project = db.insert(schema.projects).values({
      name: 'Test Project',
      path: clonedRepoPath,
      remote_url: sourceRepoPath,
    }).returning().get();

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/pull`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: Promise.resolve({ project_id: project.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.updated).toBe(false);
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
});
