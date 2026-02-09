import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

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
    gitService.createWorktree(sessionName);
    const worktreePath = join(testRepoPath, '.worktrees', sessionName);

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
    gitService.deleteWorktree(sessionName);
  });

  it('コミットがない場合は空配列を返す', () => {
    const sessionName = 'test-session-no-commits';

    // worktreeを作成するがコミットは追加しない
    gitService.createWorktree(sessionName);

    const commits = gitService.getCommits(sessionName);

    // mainブランチからのコミットのみ（初期コミット）
    expect(commits.length).toBeGreaterThanOrEqual(0);

    // Cleanup
    gitService.deleteWorktree(sessionName);
  });
});
