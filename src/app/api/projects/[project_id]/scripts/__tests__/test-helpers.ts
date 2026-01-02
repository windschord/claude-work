import { prisma } from '@/lib/db';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project } from '@prisma/client';

/**
 * テスト用のGitリポジトリを初期化
 */
export function initTestRepo(repoPath: string): void {
  execSync('git init', { cwd: repoPath, timeout: 10000 });
  execSync('git config user.name "Test"', { cwd: repoPath, timeout: 10000 });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, timeout: 10000 });
  execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
    cwd: repoPath,
    shell: true,
    timeout: 10000,
  });
  execSync('git branch -M main', { cwd: repoPath, timeout: 10000 });
}

/**
 * テスト用の共通セットアップを実行
 */
export async function setupTestEnvironment(): Promise<{
  testRepoPath: string;
  project: Project;
}> {
  await prisma.runScript.deleteMany();
  await prisma.project.deleteMany();

  const testRepoPath = mkdtempSync(join(tmpdir(), 'project-test-'));
  initTestRepo(testRepoPath);

  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      path: testRepoPath,
    },
  });

  return { testRepoPath, project };
}

/**
 * テスト用の共通クリーンアップを実行
 */
export async function cleanupTestEnvironment(testRepoPath?: string): Promise<void> {
  await prisma.runScript.deleteMany();
  await prisma.project.deleteMany();
  if (testRepoPath) {
    rmSync(testRepoPath, { recursive: true, force: true });
  }
}
