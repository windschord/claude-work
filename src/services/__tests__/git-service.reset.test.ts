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

describe('GitService - reset', () => {
  let gitService: GitService;
  const repoPath = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    gitService = new GitService(repoPath, logger);
  });

  describe('reset', () => {
    it('should reset to specified commit', () => {
      const sessionName = 'test-session-reset';
      const commitHash = 'abc123def456';

      mockSpawnSync.mockReturnValue({
        stdout: `HEAD is now at ${commitHash} first commit`,
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.reset(sessionName, commitHash);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['reset', '--hard', commitHash],
        expect.objectContaining({
          cwd: `${repoPath}/.worktrees/${sessionName}`,
          encoding: 'utf-8',
        }),
      );
    });

    it('should execute git reset --hard correctly with proper cwd', () => {
      const sessionName = 'test-session-reset-hard';
      const commitHash = 'def789abc012';

      mockSpawnSync.mockReturnValue({
        stdout: `HEAD is now at ${commitHash} commit`,
        stderr: '',
        status: 0,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.reset(sessionName, commitHash);

      expect(result.success).toBe(true);
      // cwdがworktreeパスに正しく設定されていることを検証
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['reset', '--hard', commitHash],
        expect.objectContaining({
          cwd: `${repoPath}/.worktrees/${sessionName}`,
        }),
      );
    });

    it('should return error when commit hash is invalid', () => {
      const sessionName = 'test-session-reset-invalid';

      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: "fatal: ambiguous argument 'invalid-commit-hash': unknown revision or path not in the working tree.",
        status: 128,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.reset(sessionName, 'invalid-commit-hash');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle non-existent session gracefully', () => {
      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: "fatal: not a git repository: '/test/repo/.worktrees/non-existent-session'",
        status: 128,
        signal: null,
        pid: 0,
        output: [],
        error: undefined,
      });

      const result = gitService.reset('non-existent-session', 'abc123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
