import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    createVolume: vi.fn(),
    removeVolume: vi.fn(),
    run: vi.fn(),
    listVolumes: vi.fn(),
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

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
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
    mockDockerClient.listVolumes.mockResolvedValue({ Volumes: [], Warnings: [] });
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

  });

  describe('getCommits', () => {
    it('コミット履歴をパースして返す', async () => {
      const NUL = '\0';
      const gitOutput = [
        `abc123full${NUL}abc123${NUL}Initial commit${NUL}Author${NUL}2026-01-01T00:00:00+00:00`,
        ' 1\t0\tfile1.ts',
        ' 2\t1\tfile2.ts',
        '',
        `def456full${NUL}def456${NUL}Second commit${NUL}Author${NUL}2026-01-02T00:00:00+00:00`,
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

  describe('getVolumeName - dockerVolumeId対応', () => {
    it('dockerVolumeIdが指定された場合、getDiffDetailsがその値をボリューム名として使用する', async () => {
      mockDockerClient.run = mockRunWithStdout('');

      await dockerGitService.getDiffDetails('test-project-id', 'test-session', 'cw-repo-myproject');

      expect(mockDockerClient.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: expect.arrayContaining(['cw-repo-myproject:/repo']),
          }),
        })
      );
    });

    it('dockerVolumeIdがnullの場合、getDiffDetailsがフォールバック値を使用する', async () => {
      mockDockerClient.run = mockRunWithStdout('');

      await dockerGitService.getDiffDetails('test-project-id', 'test-session', null);

      expect(mockDockerClient.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: expect.arrayContaining(['claude-repo-test-project-id:/repo']),
          }),
        })
      );
    });

  });

  describe('Volume命名規則', () => {
    it('projectNameを指定したcloneでcw-repo-{slug}形式のVolume名が使われる', async () => {
      const result = await dockerGitService.cloneRepository({
        url: 'https://github.com/user/my-project.git',
        projectId: 'test-project-id',
        projectName: 'My Project',
      });

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('cw-repo-my-project');
    });

    it('projectNameを指定しないcloneで旧形式(claude-repo-{id})が使われる', async () => {
      const result = await dockerGitService.cloneRepository({
        url: 'https://github.com/user/repo.git',
        projectId: 'test-project-id',
      });

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
    });

    it('Volume名重複時にサフィックスが追加される', async () => {
      mockDockerClient.listVolumes.mockResolvedValue({
        Volumes: [
          { Name: 'cw-repo-my-project', Driver: 'local' },
        ],
        Warnings: [],
      });

      const result = await dockerGitService.cloneRepository({
        url: 'https://github.com/user/my-project.git',
        projectId: 'test-project-id',
        projectName: 'My Project',
      });

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('cw-repo-my-project-2');
    });

    it('projectNameを指定したPAT cloneでcw-repo-{slug}形式が使われる', async () => {
      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/my-project.git',
        'test-project-id',
        'ghp_testPATtoken123',
        'My Project'
      );

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('cw-repo-my-project');
    });
  });

  describe('cloneRepository', () => {
    it('clone成功時にsuccess:trueとvolumeNameを返す', async () => {
      const result = await dockerGitService.cloneRepository({
        url: 'https://github.com/user/repo.git',
        projectId: 'test-project-id',
      });

      expect(result.success).toBe(true);
      expect(result.volumeName).toBe('claude-repo-test-project-id');
    });

    it('clone失敗時にボリュームを削除してエラーをスローする', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 128 });

      await expect(
        dockerGitService.cloneRepository({
          url: 'https://github.com/user/repo.git',
          projectId: 'proj-fail',
        })
      ).rejects.toThrow();

      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-repo-proj-fail');
    });

    it('SSHキー認証時にBindsが追加される', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'ssh-test',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteRepository', () => {
    it('ボリューム削除成功時にsuccess:trueを返す', async () => {
      const result = await dockerGitService.deleteRepository('proj-1');
      expect(result.success).toBe(true);
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-repo-proj-1');
    });

    it('dockerVolumeId指定時にそのIDを使用する', async () => {
      const result = await dockerGitService.deleteRepository('proj-1', 'custom-vol');
      expect(result.success).toBe(true);
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('custom-vol');
    });

    it('ボリューム削除失敗時にsuccess:falseを返す', async () => {
      mockDockerClient.removeVolume.mockRejectedValue(new Error('volume not found'));

      const result = await dockerGitService.deleteRepository('proj-1');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createVolume', () => {
    it('ボリューム作成成功時にボリューム名を返す', async () => {
      const result = await dockerGitService.createVolume('proj-1');
      expect(result).toBe('claude-repo-proj-1');
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-repo-proj-1');
    });

    it('projectName指定時に新命名規則を使用する', async () => {
      const result = await dockerGitService.createVolume('proj-1', 'My Project');
      expect(result).toBe('cw-repo-my-project');
    });

    it('ボリューム作成失敗時にGitOperationErrorをスローする', async () => {
      mockDockerClient.createVolume.mockRejectedValue(new Error('failed'));

      await expect(dockerGitService.createVolume('proj-1')).rejects.toThrow('Failed to create Docker volume');
    });
  });

  describe('deleteVolume', () => {
    it('ボリューム削除成功時に正常終了する', async () => {
      await expect(dockerGitService.deleteVolume('test-vol')).resolves.toBeUndefined();
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('test-vol');
    });

    it('ボリューム削除失敗時にGitOperationErrorをスローする', async () => {
      mockDockerClient.removeVolume.mockRejectedValue(new Error('failed'));

      await expect(dockerGitService.deleteVolume('test-vol')).rejects.toThrow('Failed to delete Docker volume');
    });
  });

  describe('squashMerge error cases', () => {
    it('コンフリクト時にsuccess:falseとconflictsを返す', async () => {
      let callCount = 0;
      mockDockerClient.run.mockImplementation(
        (_image: string, _cmd: string[], streams: any[], _options: any) => {
          callCount++;
          if (callCount === 1) {
            // merge失敗
            return Promise.resolve({ StatusCode: 1 });
          }
          if (callCount === 2) {
            // conflict files
            const stdoutStream = Array.isArray(streams) ? streams[0] : streams;
            if (stdoutStream?.write) stdoutStream.write('conflict1.ts\n');
            return Promise.resolve({ StatusCode: 0 });
          }
          // merge --abort
          return Promise.resolve({ StatusCode: 0 });
        }
      );

      const result = await dockerGitService.squashMerge('proj-1', 'test-session', 'Merge');
      expect(result.success).toBe(false);
      expect(result.conflicts).toEqual(['conflict1.ts']);
    });
  });

  describe('getDiffDetails status handling', () => {
    it('Addedステータスのファイルを正しくパースする', async () => {
      const newContentB64 = Buffer.from('new file content').toString('base64');
      const gitOutput = [
        '===FILE_START===',
        'PATH:src/new-file.ts',
        'STATUS:A',
        '===OLD_CONTENT_B64===',
        '',
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        newContentB64,
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '10\t0\tsrc/new-file.ts',
        '===FILE_END===',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('added');
      expect(result.files[0].additions).toBe(10);
      expect(result.files[0].deletions).toBe(0);
    });

    it('Deletedステータスのファイルを正しくパースする', async () => {
      const oldContentB64 = Buffer.from('deleted content').toString('base64');
      const gitOutput = [
        '===FILE_START===',
        'PATH:src/deleted.ts',
        'STATUS:D',
        '===OLD_CONTENT_B64===',
        oldContentB64,
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        '',
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '0\t5\tsrc/deleted.ts',
        '===FILE_END===',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('deleted');
      expect(result.files[0].additions).toBe(0);
      expect(result.files[0].deletions).toBe(5);
      expect(result.totalDeletions).toBe(5);
    });

    it('複数ファイルの差分情報を正しくパースする', async () => {
      const content1 = Buffer.from('content1').toString('base64');
      const content2 = Buffer.from('content2').toString('base64');
      const gitOutput = [
        '===FILE_START===',
        'PATH:file1.ts',
        'STATUS:M',
        '===OLD_CONTENT_B64===',
        content1,
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        content2,
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '3\t1\tfile1.ts',
        '===FILE_END===',
        '===FILE_START===',
        'PATH:file2.ts',
        'STATUS:A',
        '===OLD_CONTENT_B64===',
        '',
        '===OLD_CONTENT_B64_END===',
        '===NEW_CONTENT_B64===',
        content2,
        '===NEW_CONTENT_B64_END===',
        '===NUMSTAT_START===',
        '5\t0\tfile2.ts',
        '===FILE_END===',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const result = await dockerGitService.getDiffDetails('proj-1', 'test-session');
      expect(result.files).toHaveLength(2);
      expect(result.totalAdditions).toBe(8);
      expect(result.totalDeletions).toBe(1);
    });
  });

  describe('getCommits with file changes', () => {
    it('numstatの行をfiles_changedとしてカウントする', async () => {
      const NUL = '\0';
      const gitOutput = [
        `hash1${NUL}h1${NUL}Commit 1${NUL}Author${NUL}2026-01-01T00:00:00+00:00`,
        ' 10\t5\tfile1.ts',
        ' -\t-\tbinary-file.png',
      ].join('\n');

      mockDockerClient.run = mockRunWithStdout(gitOutput);

      const commits = await dockerGitService.getCommits('proj-1', 'test-session');
      expect(commits).toHaveLength(1);
      expect(commits[0].files_changed).toBe(2);
    });
  });

  describe('logging', () => {
    it('cloneRepository成功時にログを記録する', async () => {
      await dockerGitService.cloneRepository({
        url: 'https://github.com/user/repo.git',
        projectId: 'log-test',
      });

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('createVolume成功時にログを記録する', async () => {
      await dockerGitService.createVolume('log-vol-test');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[docker] Creating Docker volume',
        expect.objectContaining({ volumeName: 'claude-repo-log-vol-test' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[docker] Docker volume created',
        expect.objectContaining({ volumeName: 'claude-repo-log-vol-test' })
      );
    });

    it('createVolume失敗時にエラーログを記録する', async () => {
      mockDockerClient.createVolume.mockRejectedValue(new Error('disk full'));

      try {
        await dockerGitService.createVolume('log-vol-fail');
      } catch {
        // expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[docker] Failed to create Docker volume',
        expect.objectContaining({ volumeName: 'claude-repo-log-vol-fail' })
      );
    });
  });

  describe('validateSessionName', () => {
    it('ドット(.)のみの名前を拒否する', async () => {
      await expect(
        dockerGitService.getCommits('proj-1', '.')
      ).rejects.toThrow('Invalid session name');
    });

    it('ドットドット(..)を含む名前を拒否する', async () => {
      await expect(
        dockerGitService.getCommits('proj-1', 'test..session')
      ).rejects.toThrow('Invalid session name');
    });

    it('有効な名前を受け付ける', async () => {
      mockDockerClient.run = mockRunWithStdout('');
      // valid session names should not throw
      await expect(
        dockerGitService.getCommits('proj-1', 'valid-session_name.1')
      ).resolves.toBeDefined();
    });
  });

  describe('validateCommitHash', () => {
    it('有効なコミットハッシュを受け付ける', async () => {
      // 短いハッシュ (4文字)
      const result = await dockerGitService.reset('proj-1', 'test-session', 'abcd');
      expect(result).toBeDefined();
    });

    it('40文字のフルハッシュを受け付ける', async () => {
      const fullHash = 'a'.repeat(40);
      const result = await dockerGitService.reset('proj-1', 'test-session', fullHash);
      expect(result).toBeDefined();
    });
  });

  describe('reset with dockerVolumeId', () => {
    it('dockerVolumeIdを使用してリセットする', async () => {
      const result = await dockerGitService.reset('proj-1', 'test-session', 'abc123', 'custom-vol');
      expect(result.success).toBe(true);
      expect(mockDockerClient.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: expect.arrayContaining(['custom-vol:/repo']),
          }),
        })
      );
    });
  });

  describe('rebaseFromMain with dockerVolumeId', () => {
    it('dockerVolumeIdを使用してリベースする', async () => {
      const result = await dockerGitService.rebaseFromMain('proj-1', 'test-session', 'custom-vol');
      expect(result.success).toBe(true);
    });
  });

  describe('squashMerge with dockerVolumeId', () => {
    it('dockerVolumeIdを使用してマージする', async () => {
      const result = await dockerGitService.squashMerge('proj-1', 'test-session', 'Merge msg', 'custom-vol');
      expect(result.success).toBe(true);
    });
  });

  describe('getCommits with dockerVolumeId', () => {
    it('dockerVolumeIdを使用してコミット取得する', async () => {
      mockDockerClient.run = mockRunWithStdout('');
      const commits = await dockerGitService.getCommits('proj-1', 'test-session', 'custom-vol');
      expect(commits).toEqual([]);
    });
  });
});
