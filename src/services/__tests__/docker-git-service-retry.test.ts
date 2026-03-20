import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ホイストされたモックを作成
const { mockDockerClient, mockLogger } = vi.hoisted(() => ({
  mockDockerClient: {
    createVolume: vi.fn(),
    removeVolume: vi.fn(),
    run: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// DockerClientモジュールをモック
vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// fs/promisesをモック（SSH/gitconfig等のアクセスチェックは全て失敗させる）
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
  logger: mockLogger,
}));

vi.mock('@/services/config-service', () => ({
  getConfigService: vi.fn(() => ({
    getGitCloneTimeoutMs: vi.fn(() => 300000),
    getDebugModeKeepVolumes: vi.fn(() => false),
  })),
}));

import { DockerGitService } from '../docker-git-service';
import { GitOperationError } from '../git-operations';

/**
 * DockerGitService リトライロジック テスト（TDD Green phase完了済み）
 *
 * 期待される動作:
 * - 一時的なエラー（ネットワーク不安定等）では最大3回までリトライ
 * - 永続的なエラー（パスが存在しない等）では即座に失敗
 * - リトライ間隔は指数バックオフ（約1000ms, 2000ms）
 * - 各リトライ試行をログに記録
 */
describe('DockerGitService リトライロジック', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dockerGitService = new DockerGitService();

    // デフォルト: 全て成功
    mockDockerClient.createVolume.mockResolvedValue({});
    mockDockerClient.removeVolume.mockResolvedValue({});
    mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cloneRepository', () => {
    it('一時的なエラーで最大3回までリトライして成功する', async () => {
      // clone 1回目: 一時的エラー（reject）
      // clone 2回目: 一時的エラー（reject）
      // clone 3回目: 成功
      mockDockerClient.run
        .mockRejectedValueOnce(new Error('Connection timed out'))
        .mockRejectedValueOnce(new Error('Connection reset by peer'))
        .mockResolvedValueOnce({ StatusCode: 0 });

      const result = await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'test-project-id',
      });

      expect(result.success).toBe(true);

      // createVolume 1回 + run (clone試行) 3回
      expect(mockDockerClient.createVolume).toHaveBeenCalledTimes(1);
      expect(mockDockerClient.run).toHaveBeenCalledTimes(3);
    });

    it('永続的なエラー（No such file or directory）ではリトライしない', async () => {
      // clone: 永続エラー（reject）
      const error = new Error('No such file or directory');
      (error as any).stderr = 'fatal: No such file or directory';
      mockDockerClient.run.mockRejectedValueOnce(error);

      await expect(
        dockerGitService.cloneRepository({
          url: 'git@github.com:user/repo.git',
          projectId: 'test-project-id',
        })
      ).rejects.toThrow(GitOperationError);

      // createVolume 1回 + run (clone試行) 1回のみ（リトライなし）
      expect(mockDockerClient.createVolume).toHaveBeenCalledTimes(1);
      expect(mockDockerClient.run).toHaveBeenCalledTimes(1);

      // エラー後にボリュームがクリーンアップされること
      expect(mockDockerClient.removeVolume).toHaveBeenCalledTimes(1);
    });

    it('リトライ時にログが出力される', async () => {
      // clone 1回目: 一時的エラー → clone 2回目: 成功
      mockDockerClient.run
        .mockRejectedValueOnce(new Error('Connection timed out'))
        .mockResolvedValueOnce({ StatusCode: 0 });

      await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'test-project-id',
      });

      // リトライに関するログが出力されていることを検証
      const warnCalls = mockLogger.warn.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      const infoCalls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      const allMessages = [...warnCalls, ...infoCalls];

      expect(
        allMessages.some(
          (msg: string) =>
            msg.includes('retry') || msg.includes('Retry') || msg.includes('retrying')
        )
      ).toBe(true);
    });
  });

  describe('cloneRepositoryWithPAT', () => {
    it('一時的なエラーでリトライして成功する', async () => {
      // clone 1回目: 一時的エラー → clone 2回目: 成功
      mockDockerClient.run
        .mockRejectedValueOnce(new Error('Connection timed out'))
        .mockResolvedValueOnce({ StatusCode: 0 });

      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/private-repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      expect(result.success).toBe(true);

      // createVolume 1回 + run (PAT clone試行) 2回
      expect(mockDockerClient.createVolume).toHaveBeenCalledTimes(1);
      expect(mockDockerClient.run).toHaveBeenCalledTimes(2);
    });

    it('最大リトライ回数後にエラーをスローしボリュームをクリーンアップする', async () => {
      // 全てのclone試行が失敗
      mockDockerClient.run.mockRejectedValue(new Error('Connection timed out'));

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/private-repo.git',
          'test-project-id',
          'ghp_testPATtoken123'
        )
      ).rejects.toThrow(GitOperationError);

      // createVolume 1回 + run (PAT clone試行) 3回
      expect(mockDockerClient.createVolume).toHaveBeenCalledTimes(1);
      expect(mockDockerClient.run).toHaveBeenCalledTimes(3);

      // ボリュームクリーンアップが呼ばれたことを確認
      expect(mockDockerClient.removeVolume).toHaveBeenCalledTimes(1);
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
    });
  });

  describe('指数バックオフ', () => {
    it('リトライ間隔が指数的に増加する（約1000ms, 2000ms）', async () => {
      // setTimeoutの呼び出しを監視してバックオフ遅延を検証
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // 全てのclone試行が失敗するケース（3回試行後に失敗）
      mockDockerClient.run.mockRejectedValue(new Error('Connection timed out'));

      await expect(
        dockerGitService.cloneRepository({
          url: 'git@github.com:user/repo.git',
          projectId: 'test-project-id',
        })
      ).rejects.toThrow(GitOperationError);

      // setTimeoutまたはsleep的な遅延が呼ばれたことを確認
      // 実装: BASE_DELAY_MS(1000) * Math.pow(2, attempt - 1)
      //   attempt=1: 1000ms, attempt=2: 2000ms
      // CI環境のタイマー精度のばらつきを考慮して広めの範囲で検証
      const timeoutCalls = setTimeoutSpy.mock.calls
        .map((call) => call[1] as number)
        .filter((ms) => ms >= 500 && ms <= 10000); // バックオフ遅延のみ抽出（短いタイムアウトとコンテナタイムアウトを除外）

      expect(timeoutCalls.length).toBeGreaterThanOrEqual(2);

      // 1回目のバックオフ: BASE_DELAY_MS * 2^0 = 1000ms (CI jitter許容: 800-1500ms)
      expect(timeoutCalls[0]).toBeGreaterThanOrEqual(800);
      expect(timeoutCalls[0]).toBeLessThanOrEqual(1500);

      // 2回目のバックオフ: BASE_DELAY_MS * 2^1 = 2000ms (CI jitter許容: 1600-3000ms)
      expect(timeoutCalls[1]).toBeGreaterThanOrEqual(1600);
      expect(timeoutCalls[1]).toBeLessThanOrEqual(3000);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('PAT sanitization', () => {
    it('PAT is sanitized in error messages when retryWithBackoff throws', async () => {
      // 永続的エラーにPATが含まれるケース
      const error = new Error('fatal: Authentication failed for GIT_PAT=ghp_secret123');
      (error as any).stderr = 'remote: Invalid credentials GIT_PAT=ghp_secret123';
      (error as any).stdout = 'Cloning with GIT_PAT=ghp_secret123';
      mockDockerClient.run.mockRejectedValueOnce(error);

      let caughtError: GitOperationError | null = null;
      try {
        await dockerGitService.cloneRepository({
          url: 'https://github.com/user/repo.git',
          projectId: 'test-project-id',
        });
      } catch (err) {
        caughtError = err as GitOperationError;
      }

      expect(caughtError).toBeInstanceOf(GitOperationError);
      // Error message should not contain raw PAT
      expect(caughtError!.message).not.toContain('ghp_secret123');
    });
  });
});
