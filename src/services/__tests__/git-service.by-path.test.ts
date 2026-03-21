import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { spawnSync } from 'child_process';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const mockExports = {
    ...actual,
    spawnSync: vi.fn(),
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

const mockSpawnSync = vi.mocked(spawnSync);

/**
 * ByPathメソッドのテスト
 *
 * Claude Code --worktreeモード（branch_name === ''）では、
 * worktree_pathがプロジェクトルートを指すため、
 * sessionNameベースのパス構築（.worktrees/<name>）が使えない。
 * ByPathメソッドはworktreeパスを直接受け取ることでこの問題を解決する。
 */
describe('GitService ByPath methods', () => {
  let gitService: GitService;
  const repoPath = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    gitService = new GitService(repoPath, logger);
  });

  describe('getDiffByPath', () => {
    it('should call git diff --name-status with worktree path as cwd', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';

      mockSpawnSync.mockReturnValue({
        stdout: 'A\tnew-file.txt\nM\tREADME.md\n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const diff = gitService.getDiffByPath(worktreePath);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', '--name-status']),
        expect.objectContaining({
          cwd: worktreePath,
          encoding: 'utf-8',
        }),
      );
      expect(diff.added).toContain('new-file.txt');
      expect(diff.modified).toContain('README.md');
    });

    it('should work with project root path (--worktree mode)', () => {
      // Claude Code --worktreeモードでは worktree_path がプロジェクトルート
      const worktreePath = repoPath;

      mockSpawnSync.mockReturnValue({
        stdout: 'A\tworktree-file.txt\n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const diff = gitService.getDiffByPath(worktreePath);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', '--name-status']),
        expect.objectContaining({
          cwd: repoPath,
        }),
      );
      expect(diff.added).toContain('worktree-file.txt');
    });
  });

  describe('getCommitsByPath', () => {
    it('should call git log with -C worktreePath', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';
      const gitLogOutput = [
        'abc123full|abc123|test commit|Author|2026-03-20T10:00:00+09:00',
        '1\t0\tfile.txt',
        '',
      ].join('\n');

      mockSpawnSync.mockReturnValue({
        stdout: gitLogOutput,
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const commits = gitService.getCommitsByPath(worktreePath);

      const callArgs = mockSpawnSync.mock.calls[0];
      expect(callArgs[0]).toBe('git');
      expect(callArgs[1]).toContain('-C');
      expect(callArgs[1]).toContain(worktreePath);

      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('test commit');
    });

    it('should return empty array on error', () => {
      const worktreePath = '/test/repo/.worktrees/nonexistent';

      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: 'fatal: not a git repository',
        status: 128,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const commits = gitService.getCommitsByPath(worktreePath);
      expect(commits).toEqual([]);
    });
  });

  describe('rebaseFromMainByPath', () => {
    it('should call git rebase with cwd set to worktreePath', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';

      mockSpawnSync.mockReturnValue({
        stdout: 'Successfully rebased',
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.rebaseFromMainByPath(worktreePath);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['rebase', 'main'],
        expect.objectContaining({
          cwd: worktreePath,
          encoding: 'utf-8',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should detect conflicts and abort', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';

      // rebase fails with conflict
      mockSpawnSync
        .mockReturnValueOnce({
          stdout: '',
          stderr: 'CONFLICT (content): Merge conflict in file.txt',
          status: 1,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        })
        // git diff --name-only --diff-filter=U
        .mockReturnValueOnce({
          stdout: 'file.txt\n',
          stderr: '',
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        })
        // git rebase --abort
        .mockReturnValueOnce({
          stdout: '',
          stderr: '',
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        });

      const result = gitService.rebaseFromMainByPath(worktreePath);

      expect(result.success).toBe(false);
      expect(result.conflicts).toContain('file.txt');
    });
  });

  describe('resetByPath', () => {
    it('should call git reset --hard with cwd set to worktreePath', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';
      const commitHash = 'abc123def456';

      mockSpawnSync.mockReturnValue({
        stdout: `HEAD is now at ${commitHash} initial`,
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.resetByPath(worktreePath, commitHash);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['reset', '--hard', commitHash],
        expect.objectContaining({
          cwd: worktreePath,
          encoding: 'utf-8',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should return error for invalid commit hash', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';

      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: "fatal: ambiguous argument 'invalid': unknown revision",
        status: 128,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.resetByPath(worktreePath, 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getDiffDetailsByPath', () => {
    it('should call git diff with cwd set to worktreePath', () => {
      const worktreePath = '/test/repo/.worktrees/test-session';

      // getDiffDetailsByPathは以下の順にspawnSyncを呼ぶ:
      // 1. git diff --name-status main...HEAD
      // 2. git show HEAD:<file> (status !== 'deleted'の場合)
      // 3. git diff --numstat main...HEAD -- <file>
      mockSpawnSync
        .mockReturnValueOnce({
          stdout: 'A\tfile.txt\n',
          stderr: '',
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        })
        // git show HEAD:file.txt (新内容の取得)
        .mockReturnValueOnce({
          stdout: 'new line\n',
          stderr: '',
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        })
        // git diff --numstat main...HEAD -- file.txt (追加/削除行数)
        .mockReturnValueOnce({
          stdout: '1\t0\tfile.txt\n',
          stderr: '',
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          error: undefined,
        });

      const details = gitService.getDiffDetailsByPath(worktreePath);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', '--name-status']),
        expect.objectContaining({
          cwd: worktreePath,
          encoding: 'utf-8',
        }),
      );
      expect(details.files).toHaveLength(1);
      expect(details.files[0].path).toBe('file.txt');
      expect(details.files[0].status).toBe('added');
    });
  });
});
