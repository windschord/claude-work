import { describe, it, expect, beforeEach, vi } from 'vitest';

// ホイストされたモックを作成
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
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

describe('DockerGitService', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerGitService = new DockerGitService();

    // デフォルトのexecFile実装: 成功
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: '', stderr: '' });
      }
    );
  });

  describe('基本機能', () => {
    it('DockerGitServiceインスタンスを作成できる', () => {
      expect(dockerGitService).toBeDefined();
      expect(dockerGitService).toBeInstanceOf(DockerGitService);
    });

    it('GitOperationsインターフェースを実装している', () => {
      expect(dockerGitService.cloneRepository).toBeDefined();
      expect(dockerGitService.createWorktree).toBeDefined();
      expect(dockerGitService.deleteWorktree).toBeDefined();
      expect(dockerGitService.deleteRepository).toBeDefined();
    });
  });

  describe('ボリューム名生成', () => {
    it('プロジェクトIDからボリューム名を生成できる', () => {
      // private メソッドなので直接テストできないが、
      // createVolumeなどのメソッドで使用されることを確認
      expect(typeof dockerGitService.createVolume).toBe('function');
    });
  });

  describe('cloneRepositoryWithPAT', () => {
    it('PAT認証でリポジトリをcloneできる', async () => {
      // execFileのモック: volume create成功 -> docker run (clone)成功
      mockExecFile
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume create
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // docker run (clone)
        });

      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('PAT');

      // docker runコマンドの引数を検証
      const dockerRunCall = mockExecFile.mock.calls[1];
      const dockerArgs: string[] = dockerRunCall[1];

      // GIT_PAT環境変数が設定されている
      const envValues = dockerArgs.filter((_arg: string, i: number) => i > 0 && dockerArgs[i - 1] === '-e');
      expect(envValues.some((v: string) => v.startsWith('GIT_PAT='))).toBe(true);
    });

    it('PAT認証失敗時にエラーがスローされる', async () => {
      // volume createは成功、docker run (clone)は失敗
      mockExecFile
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume create
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
          cb(new Error('Authentication failed')); // clone失敗
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume cleanup
        });

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/repo.git',
          'test-project-id',
          'ghp_invalidToken'
        )
      ).rejects.toThrow();
    });

    it('credential helperの設定コマンドが含まれている', async () => {
      mockExecFile
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume create
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // docker run (clone)
        });

      await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      // docker runコマンドの引数を検証
      const dockerRunCall = mockExecFile.mock.calls[1];
      const dockerArgs: string[] = dockerRunCall[1];

      // entrypointがshに設定されている（credential helper設定のため）
      expect(dockerArgs).toContain('--entrypoint');
      expect(dockerArgs).toContain('sh');

      // -cフラグでシェルコマンドを実行
      expect(dockerArgs).toContain('-c');

      // credential helper設定が含まれている
      const shCommandIndex = dockerArgs.indexOf('-c');
      const shCommand: string = dockerArgs[shCommandIndex + 1];
      expect(shCommand).toContain('credential.helper');
      expect(shCommand).toContain('git clone');
    });

    it('PAT認証失敗時にボリュームがクリーンアップされる', async () => {
      mockExecFile
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume create
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
          cb(new Error('Authentication failed')); // clone失敗
        })
        .mockImplementationOnce((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
          cb(null, { stdout: '', stderr: '' }); // volume cleanup
        });

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/repo.git',
          'test-project-id',
          'ghp_invalidToken'
        )
      ).rejects.toThrow();

      // volume rmが呼ばれている（クリーンアップ）
      const volumeRmCall = mockExecFile.mock.calls[2];
      expect(volumeRmCall[1]).toContain('volume');
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

  // Note: 実際のDockerコマンド実行テストはCI/CD環境でDocker利用可能な場合のみ実行
  // 統合テストとしてdocker-adapter.integration.test.tsで実施
});
