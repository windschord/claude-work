import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * テスト用のGitリポジトリを作成
 */
export async function createTestGitRepo(): Promise<string> {
  const tmpDir = path.join(__dirname, '../../tmp/test-repo');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

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
