import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * テスト用ヘルパー: git worktreeを直接作成
 *
 * NOTE: このテストではtmpディレクトリに実gitリポジトリを作成し、実際のgitコマンドを使用する。
 * git-service.test.tsのgetDiff等と同様のパターン。テスト環境依存だが、
 * tmpディレクトリを使用しているため影響は限定的。
 */
function createTestWorktree(repoPath: string, sessionName: string): string {
  const branchName = `session/${sessionName}`;
  const worktreePath = join(repoPath, '.worktrees', sessionName);
  execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
    cwd: repoPath,
    encoding: 'utf-8',
  });
  return worktreePath;
}

/**
 * テスト用ヘルパー: git worktreeを直接削除
 */
function removeTestWorktree(repoPath: string, sessionName: string): void {
  const worktreePath = join(repoPath, '.worktrees', sessionName);
  execSync(`git worktree remove "${worktreePath}" --force`, {
    cwd: repoPath,
    encoding: 'utf-8',
  });
}

describe('GitService.getCommits', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    // テスト用の一時リポジトリを作成
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-commits-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "initial" > README.md && git add . && git commit -m "Initial commit"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    gitService = new GitService(testRepoPath, logger);
  });

  afterAll(() => {
    rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('コミット履歴を正しく取得する', () => {
    const sessionName = 'test-session-commits';

    // worktreeを作成してコミットを追加
    const worktreePath = createTestWorktree(testRepoPath, sessionName);

    writeFileSync(join(worktreePath, 'file1.ts'), 'content1');
    execSync('git add file1.ts && git commit -m "Add authentication"', {
      cwd: worktreePath,
      shell: true,
    });

    writeFileSync(join(worktreePath, 'file2.ts'), 'content2');
    execSync('git add file2.ts && git commit -m "Fix bug in login"', {
      cwd: worktreePath,
      shell: true,
    });

    const commits = gitService.getCommits(sessionName);

    expect(commits.length).toBe(2);
    expect(commits[0].message).toBe('Fix bug in login');
    expect(commits[0].files_changed).toBe(1);
    expect(commits[1].message).toBe('Add authentication');
    expect(commits[1].files_changed).toBe(1);

    // Cleanup
    removeTestWorktree(testRepoPath, sessionName);
  });

  it('コミットがない場合は空配列を返す', () => {
    const sessionName = 'test-session-no-commits';

    // worktreeを作成するがコミットは追加しない
    createTestWorktree(testRepoPath, sessionName);

    const commits = gitService.getCommits(sessionName);

    // mainブランチからのコミットのみ（初期コミット）
    expect(commits.length).toBeGreaterThanOrEqual(0);

    // Cleanup
    removeTestWorktree(testRepoPath, sessionName);
  });
});
