import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    createVolume: vi.fn(),
    removeVolume: vi.fn(),
    run: vi.fn(),
  }
}));

vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// fs/promisesをモック
vi.mock('fs/promises', async () => {
  const mockFs = {
    access: vi.fn().mockRejectedValue(new Error('not found')),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/config-service', () => ({
  getConfigService: vi.fn(() => ({
    getGitCloneTimeoutMs: vi.fn(() => 300000),
    getDebugModeKeepVolumes: vi.fn(() => false),
  })),
}));

import { DockerGitService } from '../docker-git-service';

/**
 * DockerClient.run() のモックヘルパー
 * stdoutストリームにデータを書き込んでからStatusCodeを返す
 */
function mockRunWithStdout(stdout: string, statusCode = 0) {
  return vi.fn().mockImplementation(
    (_image: string, _cmd: string[], streams: any[], _options: any) => {
      const stdoutStream = Array.isArray(streams) ? streams[0] : streams;
      if (stdoutStream && typeof stdoutStream.write === 'function') {
        stdoutStream.write(stdout);
      }
      return Promise.resolve({ StatusCode: statusCode });
    }
  );
}

describe('DockerGitService', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerGitService = new DockerGitService();
    mockDockerClient.createVolume.mockResolvedValue({});
    mockDockerClient.removeVolume.mockResolvedValue({});
    mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });
  });

  describe('基本機能', () => {
    it('DockerGitServiceインスタンスを作成できる', () => {
      expect(dockerGitService).toBeDefined();
      expect(dockerGitService).toBeInstanceOf(DockerGitService);
    });
  });

  describe('cloneRepositoryWithPAT', () => {
    it('PAT認証でリポジトリをcloneできる', async () => {
      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
      
      expect(mockDockerClient.run).toHaveBeenCalledWith(
        expect.stringContaining('alpine/git'),
        expect.arrayContaining(['-c', expect.stringContaining('git clone')]),
        expect.any(Array),
        expect.objectContaining({
          Env: expect.arrayContaining([expect.stringContaining('GIT_PAT=')])
        })
      );
    });

    it('PAT認証失敗時にエラーがスローされる', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 128 }); // Fail

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/repo.git',
          'test-project-id',
          'ghp_invalidToken'
        )
      ).rejects.toThrow('Command failed');
      
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
    });

    it('HTTPS以外のURLではエラーがスローされる', async () => {
      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'git@github.com:user/repo.git',
          'test-project-id',
          'ghp_testPATtoken123'
        )
      ).rejects.toThrow('HTTPS');
    });
  });

  describe('入力バリデーション', () => {
    it('不正なセッション名でgetDiffDetailsがエラーになる', async () => {
      await expect(
        dockerGitService.getDiffDetails('proj-1', '../malicious')
      ).rejects.toThrow('Invalid session name');
    });

    it('不正なセッション名でrebaseFromMainがエラーになる', async () => {
      await expect(
        dockerGitService.rebaseFromMain('proj-1', 'session;rm -rf /')
      ).rejects.toThrow('Invalid session name');
    });

    it('不正なコミットハッシュでresetがエラーになる', async () => {
      await expect(
        dockerGitService.reset('proj-1', 'valid-session', 'not-a-hash!')
      ).rejects.toThrow('Invalid commit hash');
    });

    it('パストラバーサルを含むセッション名でエラーになる', async () => {
      await expect(
        dockerGitService.getCommits('proj-1', '..')
      ).rejects.toThrow('Invalid session name');
    });

    it('不正なセッション名でcreateWorktreeがエラーになる', async () => {
      await expect(
        dockerGitService.createWorktree({ projectId: 'proj-1', sessionName: '../escape', branchName: 'test' })
      ).rejects.toThrow('Invalid session name');
    });

    it('不正なセッション名でdeleteWorktreeがエラーになる', async () => {
      await expect(
        dockerGitService.deleteWorktree('proj-1', 'session;rm -rf /')
      ).rejects.toThrow('Invalid session name');
    });
  });

  describe('getCommits', () => {
    it('コミット履歴をパースして返す', async () => {
      const delimiter = '===COMMIT_DELIM===';
      const gitOutput = [
        `abc123full${delimiter}abc123${delimiter}Initial commit${delimiter}Author${delimiter}2026-01-01T00:00:00+00:00`,
        ' 1\t0\tfile1.ts',
        ' 2\t1\tfile2.ts',
        '',
        `def456full${delimiter}def456${delimiter}Second commit${delimiter}Author${delimiter}2026-01-02T00:00:00+00:00`,
        ' 3\t0\tfile3.ts',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const commits = await dockerGitService.getCommits('proj-1', 'test-session');

      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe('abc123full');
      expect(commits[0].short_hash).toBe('abc123');
      expect(commits[0].message).toBe('Initial commit');
      expect(commits[0].files_changed).toBe(2);
      expect(commits[1].hash).toBe('def456full');
      expect(commits[1].files_changed).toBe(1);
    });

    it('コミットがない場合は空配列を返す', async () => {
      mockDockerClient.run = mockRunWithStdout('');

      const commits = await dockerGitService.getCommits('proj-1', 'test-session');
      expect(commits).toEqual([]);
    });
  });

  describe('rebaseFromMain', () => {
    it('リベース成功時にsuccess:trueを返す', async () => {
      const result = await dockerGitService.rebaseFromMain('proj-1', 'test-session');
      expect(result).toEqual({ success: true });
    });

    it('コンフリクト時にsuccess:falseとconflictsを返す', async () => {
      // 1回目のrun (rebase) は失敗
      // 2回目のrun (diff --name-only) はコンフリクトファイルを返す
      // 3回目のrun (rebase --abort) は成功
      let callCount = 0;
      mockDockerClient.run.mockImplementation(
        (_image: string, _cmd: string[], streams: any[], _options: any) => {
          callCount++;
          if (callCount === 1) {
            // rebase失敗
            return Promise.resolve({ StatusCode: 1 });
          }
          if (callCount === 2) {
            // conflict files
            const stdoutStream = Array.isArray(streams) ? streams[0] : streams;
            if (stdoutStream?.write) stdoutStream.write('file1.ts\nfile2.ts\n');
            return Promise.resolve({ StatusCode: 0 });
          }
          // rebase --abort
          return Promise.resolve({ StatusCode: 0 });
        }
      );

      const result = await dockerGitService.rebaseFromMain('proj-1', 'test-session');
      expect(result.success).toBe(false);
      expect(result.conflicts).toEqual(['file1.ts', 'file2.ts']);
    });
  });

  describe('reset', () => {
    it('リセット成功時にsuccess:trueを返す', async () => {
      const result = await dockerGitService.reset('proj-1', 'test-session', 'abc123def');
      expect(result).toEqual({ success: true });
    });

    it('リセット失敗時にsuccess:falseとerrorを返す', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 128 });

      const result = await dockerGitService.reset('proj-1', 'test-session', 'abc123def');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getDiffDetails', () => {
    it('差分がない場合は空の結果を返す', async () => {
      mockDockerClient.run = mockRunWithStdout('');

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toEqual([]);
      expect(result.totalAdditions).toBe(0);
      expect(result.totalDeletions).toBe(0);
    });

    it('ファイルの差分情報をパースして返す', async () => {
      const oldContentB64 = Buffer.from('old content').toString('base64');
      const newContentB64 = Buffer.from('new content').toString('base64');
      const gitOutput = [
        '===FILE_START===',
        'PATH:src/test.ts',
        'STATUS:M',
        '===OLD_CONTENT_B64===',
        oldContentB64,
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        newContentB64,
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '5\t2\tsrc/test.ts',
        '===FILE_END===',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/test.ts');
      expect(result.files[0].status).toBe('modified');
      expect(result.files[0].oldContent).toBe('old content');
      expect(result.files[0].newContent).toBe('new content');
      expect(result.files[0].additions).toBe(5);
      expect(result.files[0].deletions).toBe(2);
      expect(result.totalAdditions).toBe(5);
      expect(result.totalDeletions).toBe(2);
    });

    it('rename/copyステータスのファイルをmodifiedとしてパースする', async () => {
      const newContentB64 = Buffer.from('renamed content').toString('base64');
      const gitOutput = [
        '===FILE_START===',
        'PATH:src/new-name.ts',
        'STATUS:R100',
        '===OLD_CONTENT_B64===',
        Buffer.from('original content').toString('base64'),
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        newContentB64,
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '0\t0\tsrc/new-name.ts',
        '===FILE_END===',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/new-name.ts');
      expect(result.files[0].status).toBe('modified');
    });
  });

  describe('squashMerge', () => {
    it('スカッシュマージ成功時にsuccess:trueを返す', async () => {
      const result = await dockerGitService.squashMerge('proj-1', 'test-session', 'Merge commit');
      expect(result).toEqual({ success: true });
    });
  });
});
