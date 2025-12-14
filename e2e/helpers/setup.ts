import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * テスト用のGitリポジトリを作成
 */
export async function createTestGitRepo(): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-repo-'));

  execSync('git init', { cwd: tmpDir });
  execSync('git config user.name "Test User"', { cwd: tmpDir });
  execSync('git config user.email "test@example.com"', { cwd: tmpDir });

  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Repo');
  execSync('git add .', { cwd: tmpDir });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir });

  return tmpDir;
}

/**
 * テスト用のGitリポジトリをクリーンアップ
 */
export async function cleanupTestGitRepo(repoPath: string): Promise<void> {
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
}
