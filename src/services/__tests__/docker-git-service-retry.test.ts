import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ホイストされたモックを作成
const { mockExecFile, mockLogger } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// child_processモジュールをモック
vi.mock('child_process', async () => {
  const mockExports = {
    execFile: mockExecFile,
    exec: vi.fn(),
    spawn: vi.fn(),
    fork: vi.fn(),
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

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

  // execFileのcallback型ヘルパー
  type ExecFileCallback = (
    err: Error | null,
    result?: { stdout: string; stderr: string }
  ) => void;

  /**
   * execFileの成功レスポンスを返すモック実装を生成
   */
  const successImpl = () => {
    return (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: ExecFileCallback
    ) => {
      cb(null, { stdout: '', stderr: '' });
    };
  };

  /**
   * execFileのエラーレスポンスを返すモック実装を生成
   */
  const failureImpl = (message: string) => {
    return (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: ExecFileCallback
    ) => {
      cb(new Error(message));
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dockerGitService = new DockerGitService();

    // デフォルト: 全て成功
    mockExecFile.mockImplementation(successImpl());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cloneRepository', () => {
    it('一時的なエラーで最大3回までリトライして成功する', async () => {
      // 1回目: volume create成功
      // 2回目: docker run (clone) 失敗 - 一時的エラー
      // 3回目: docker run (clone) 失敗 - 一時的エラー
      // 4回目: docker run (clone) 成功
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('Connection timed out')) // clone 1回目: 失敗
        .mockImplementationOnce(failureImpl('Connection reset by peer')) // clone 2回目: 失敗
        .mockImplementationOnce(successImpl()); // clone 3回目: 成功

      const result = await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'test-project-id',
      });

      expect(result.success).toBe(true);

      // execFileの呼び出し回数を確認: volume create (1) + clone試行 (3) = 4回
      expect(mockExecFile).toHaveBeenCalledTimes(4);
    });

    it('永続的なエラー（No such file or directory）ではリトライしない', async () => {
      // 1回目: volume create成功
      // 2回目: docker run (clone) 失敗 - 永続的エラー
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('No such file or directory')) // clone: 永続エラー
        .mockImplementationOnce(successImpl()); // volume cleanup

      await expect(
        dockerGitService.cloneRepository({
          url: 'git@github.com:user/repo.git',
          projectId: 'test-project-id',
        })
      ).rejects.toThrow(GitOperationError);

      // execFileの呼び出し回数を確認: volume create (1) + clone試行 (1) + volume cleanup (1) = 3回
      // リトライしていないことを検証（clone試行が1回のみ）
      const cloneCalls = mockExecFile.mock.calls.filter(
        (call: unknown[]) => {
          const args = call[1] as string[];
          return args.includes('clone') || args.includes('run');
        }
      );
      // volume createのdocker volume createコールを除く
      // docker run (clone)が1回のみ呼ばれるべき
      expect(cloneCalls.length).toBe(1);
    });

    it('リトライ時にログが出力される', async () => {
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('Connection timed out')) // clone 1回目: 失敗
        .mockImplementationOnce(successImpl()); // clone 2回目: 成功

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

  describe('createWorktree', () => {
    it('一時的なエラーで1回リトライして成功する', async () => {
      // 1回目: docker run (worktree) 失敗 - 一時的エラー
      // 2回目: docker run (worktree) 成功
      mockExecFile
        .mockImplementationOnce(failureImpl('Connection timed out')) // worktree 1回目: 失敗
        .mockImplementationOnce(successImpl()); // worktree 2回目: 成功

      const result = await dockerGitService.createWorktree({
        projectId: 'test-project-id',
        sessionName: 'test-session',
        branchName: 'session/test-session',
      });

      expect(result.success).toBe(true);

      // execFileの呼び出し回数を確認: worktree試行 (2回)
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('最大リトライ回数(3回)後に諦めてエラーをスローする', async () => {
      // 全て失敗
      mockExecFile.mockImplementation(failureImpl('Connection timed out'));

      await expect(
        dockerGitService.createWorktree({
          projectId: 'test-project-id',
          sessionName: 'test-session',
          branchName: 'session/test-session',
        })
      ).rejects.toThrow(GitOperationError);

      // execFileの呼び出し回数を確認: worktree試行 (3回)
      expect(mockExecFile).toHaveBeenCalledTimes(3);
    });

    it('永続的なエラーではリトライしない', async () => {
      mockExecFile.mockImplementation(
        failureImpl('fatal: No such file or directory')
      );

      let caughtError: GitOperationError | null = null;
      try {
        await dockerGitService.createWorktree({
          projectId: 'test-project-id',
          sessionName: 'test-session',
          branchName: 'session/test-session',
        });
      } catch (err) {
        caughtError = err as GitOperationError;
      }

      expect(caughtError).toBeInstanceOf(GitOperationError);

      // 1回だけ試行されたことを確認
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // 永続エラーの場合、recoverable=falseでマークされるべき
      // (リトライロジック実装時に永続エラーを検出してrecoverable=falseを設定する)
      expect(caughtError!.recoverable).toBe(false);
    });
  });

  describe('cloneRepositoryWithPAT', () => {
    it('一時的なエラーでリトライして成功する', async () => {
      // 1回目: volume create成功
      // 2回目: docker run (PAT clone) 失敗 - 一時的エラー
      // 3回目: docker run (PAT clone) 成功
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('Connection timed out')) // PAT clone 1回目: 失敗
        .mockImplementationOnce(successImpl()); // PAT clone 2回目: 成功

      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/private-repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      expect(result.success).toBe(true);

      // execFileの呼び出し回数を確認: volume create (1) + PAT clone試行 (2) = 3回
      expect(mockExecFile).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数後にエラーをスローしボリュームをクリーンアップする', async () => {
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('Connection timed out')) // PAT clone 1回目: 失敗
        .mockImplementationOnce(failureImpl('Connection timed out')) // PAT clone 2回目: 失敗
        .mockImplementationOnce(failureImpl('Connection timed out')) // PAT clone 3回目: 失敗
        .mockImplementationOnce(successImpl()); // volume cleanup

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/private-repo.git',
          'test-project-id',
          'ghp_testPATtoken123'
        )
      ).rejects.toThrow(GitOperationError);

      // execFileの呼び出し回数を確認: volume create (1) + PAT clone試行 (3) + volume cleanup (1) = 5回
      // リトライロジックにより3回試行された後にクリーンアップされることを検証
      expect(mockExecFile).toHaveBeenCalledTimes(5);

      // volume cleanupが呼ばれたことを確認
      const lastCall = mockExecFile.mock.calls[mockExecFile.mock.calls.length - 1];
      const lastArgs = lastCall[1] as string[];
      expect(lastArgs).toContain('volume');
      expect(lastArgs.some((a: string) => a === 'rm')).toBe(true);
    });
  });

  describe('指数バックオフ', () => {
    it('リトライ間隔が指数的に増加する（約1000ms, 2000ms）', async () => {
      // setTimeoutの呼び出しを監視してバックオフ遅延を検証
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // 全てのclone試行が失敗するケース（3回試行後に失敗）
      mockExecFile
        .mockImplementationOnce(successImpl()) // volume create
        .mockImplementationOnce(failureImpl('Connection timed out')) // clone 1回目: 失敗
        .mockImplementationOnce(failureImpl('Connection timed out')) // clone 2回目: 失敗
        .mockImplementationOnce(failureImpl('Connection timed out')) // clone 3回目: 失敗
        .mockImplementationOnce(successImpl()); // volume cleanup

      await expect(
        dockerGitService.cloneRepository({
          url: 'git@github.com:user/repo.git',
          projectId: 'test-project-id',
        })
      ).rejects.toThrow(GitOperationError);

      // setTimeoutまたはsleep的な遅延が呼ばれたことを確認
      // 最初のリトライ前: 約1000ms
      // 2回目のリトライ前: 約2000ms
      const timeoutCalls = setTimeoutSpy.mock.calls
        .map((call) => call[1] as number)
        .filter((ms) => ms >= 500); // 短いタイムアウトをフィルタリング

      expect(timeoutCalls.length).toBeGreaterThanOrEqual(2);

      // 1回目のバックオフ: 約1000ms (800-1200ms程度の揺れを許容)
      expect(timeoutCalls[0]).toBeGreaterThanOrEqual(800);
      expect(timeoutCalls[0]).toBeLessThanOrEqual(1500);

      // 2回目のバックオフ: 約2000ms (1600-2400ms程度の揺れを許容)
      expect(timeoutCalls[1]).toBeGreaterThanOrEqual(1600);
      expect(timeoutCalls[1]).toBeLessThanOrEqual(3000);

      setTimeoutSpy.mockRestore();
    });
  });
});
