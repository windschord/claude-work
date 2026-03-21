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

describe('GitService.getCommits', () => {
  let gitService: GitService;
  const repoPath = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    gitService = new GitService(repoPath, logger);
  });

  it('コミット履歴を正しく取得する', () => {
    const sessionName = 'test-session-commits';
    const gitLogOutput = [
      'abc123full|abc123|Fix bug in login|Test User|2026-03-20T10:00:00+09:00',
      '1\t0\tfile2.ts',
      '',
      'def456full|def456|Add authentication|Test User|2026-03-20T09:00:00+09:00',
      '1\t0\tfile1.ts',
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

    const commits = gitService.getCommits(sessionName);

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['log', expect.stringContaining('--pretty=format:'), '--numstat', 'main..HEAD']),
      expect.objectContaining({
        encoding: 'utf-8',
      }),
    );

    // spawnSyncの引数にworktreeパスが含まれることを確認
    const args = mockSpawnSync.mock.calls[0][1] as string[];
    expect(args).toContain('-C');
    expect(args).toContain(`${repoPath}/.worktrees/${sessionName}`);

    expect(commits.length).toBe(2);
    expect(commits[0].message).toBe('Fix bug in login');
    expect(commits[0].files_changed).toBe(1);
    expect(commits[1].message).toBe('Add authentication');
    expect(commits[1].files_changed).toBe(1);
  });

  it('コミットがない場合は空配列を返す', () => {
    const sessionName = 'test-session-no-commits';

    mockSpawnSync.mockReturnValue({
      stdout: '',
      stderr: '',
      status: 0,
      signal: null,
      pid: 0,
      output: [],
      error: undefined,
    });

    const commits = gitService.getCommits(sessionName);

    expect(commits).toEqual([]);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['-C', `${repoPath}/.worktrees/${sessionName}`]),
      expect.objectContaining({
        encoding: 'utf-8',
      }),
    );
  });

  it('gitコマンドがエラーを返した場合は空配列を返す', () => {
    const sessionName = 'test-session-error';

    mockSpawnSync.mockReturnValue({
      stdout: '',
      stderr: 'fatal: not a git repository',
      status: 128,
      signal: null,
      pid: 0,
      output: [],
      error: undefined,
    });

    const commits = gitService.getCommits(sessionName);

    expect(commits).toEqual([]);
  });
});
