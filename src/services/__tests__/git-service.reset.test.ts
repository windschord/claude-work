import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

describe('GitService - reset', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-service-reset-test-'));
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

  describe('reset', () => {
    it('should reset to specified commit', () => {
      const sessionName = 'test-session-reset';
      const branchName = 'test-branch-reset';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      // Create first commit
      writeFileSync(join(worktreePath, 'file1.txt'), 'content1');
      execSync('git add . && git commit -m "first commit"', { cwd: worktreePath, shell: true });
      const firstCommitHash = execSync('git rev-parse HEAD', { cwd: worktreePath, encoding: 'utf-8' }).trim();

      // Create second commit
      writeFileSync(join(worktreePath, 'file2.txt'), 'content2');
      execSync('git add . && git commit -m "second commit"', { cwd: worktreePath, shell: true });

      // Reset to first commit
      const result = gitService.reset(sessionName, firstCommitHash);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify that HEAD is now at first commit
      const currentHash = execSync('git rev-parse HEAD', { cwd: worktreePath, encoding: 'utf-8' }).trim();
      expect(currentHash).toBe(firstCommitHash);

      // Verify that file2.txt no longer exists
      const files = execSync('git ls-files', { cwd: worktreePath, encoding: 'utf-8' });
      expect(files).toContain('file1.txt');
      expect(files).not.toContain('file2.txt');
    });

    it('should execute git reset --hard correctly', () => {
      const sessionName = 'test-session-reset-hard';
      const branchName = 'test-branch-reset-hard';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      // Create commit
      writeFileSync(join(worktreePath, 'file.txt'), 'original');
      execSync('git add . && git commit -m "commit"', { cwd: worktreePath, shell: true });
      const commitHash = execSync('git rev-parse HEAD', { cwd: worktreePath, encoding: 'utf-8' }).trim();

      // Modify file without committing
      writeFileSync(join(worktreePath, 'file.txt'), 'modified');

      // Reset should discard uncommitted changes
      const result = gitService.reset(sessionName, commitHash);

      expect(result.success).toBe(true);

      // Verify uncommitted changes are discarded (git reset --hard behavior)
      const fileContent = execSync('cat file.txt', { cwd: worktreePath, encoding: 'utf-8' });
      expect(fileContent.trim()).toBe('original');
    });

    it('should return error when commit hash is invalid', () => {
      const sessionName = 'test-session-reset-invalid';
      const branchName = 'test-branch-reset-invalid';
      gitService.createWorktree(sessionName, branchName);

      const result = gitService.reset(sessionName, 'invalid-commit-hash');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle non-existent session gracefully', () => {
      const result = gitService.reset('non-existent-session', 'abc123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
