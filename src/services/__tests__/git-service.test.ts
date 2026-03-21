import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * テスト用ヘルパー: git worktreeを直接作成
 * GitService.createWorktreeは削除済みのため、git CLIで直接作成する
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

describe('GitService', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-service-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', { cwd: testRepoPath, shell: true });
    execSync('git branch -M main', { cwd: testRepoPath });

    gitService = new GitService(testRepoPath, logger);
  });

  afterAll(() => {
    rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('getDiff', () => {
    it('should return added/modified/deleted files', () => {
      const sessionName = 'test-session-diff';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'new-file.txt'), 'new content');
      writeFileSync(join(worktreePath, 'README.md'), 'modified content');

      execSync('git add .', { cwd: worktreePath });
      execSync('git commit -m "test changes"', { cwd: worktreePath });

      const diff = gitService.getDiff(sessionName);

      expect(diff.added).toContain('new-file.txt');
      expect(diff.modified).toContain('README.md');
      expect(diff.deleted).toEqual([]);
    });
  });

  describe('rebaseFromMain', () => {
    it('should rebase worktree branch onto main', () => {
      const sessionName = 'test-session-rebase';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'branch-file.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'main-file.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMain(sessionName);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();

      const log = execSync('git log --oneline', { cwd: worktreePath }).toString();
      expect(log).toContain('main commit');
      expect(log).toContain('branch commit');
    });

    it('should detect conflicts', () => {
      const sessionName = 'test-session-conflict';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'conflict.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'conflict.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMain(sessionName);

      expect(result.success).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toContain('conflict.txt');
    });
  });

  describe('squashMerge', () => {
    it('should squash merge into main with commit message', () => {
      const sessionName = 'test-session-squash';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'feature.txt'), 'feature content');
      execSync('git add . && git commit -m "feature commit 1"', { cwd: worktreePath, shell: true });

      writeFileSync(join(worktreePath, 'feature2.txt'), 'feature content 2');
      execSync('git add . && git commit -m "feature commit 2"', { cwd: worktreePath, shell: true });

      const commitMessage = 'Squashed feature commits';
      const result = gitService.squashMerge(sessionName, commitMessage);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();

      const log = execSync('git log --oneline -1', { cwd: testRepoPath }).toString();
      expect(log).toContain(commitMessage);

      const status = execSync('git status', { cwd: testRepoPath }).toString();
      expect(status).toContain('nothing to commit');
    });
  });
});
