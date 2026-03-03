import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// networkFilterService をモック（hoistedで他のモックより前に定義）
const { mockApplyFilter, mockRemoveFilter } = vi.hoisted(() => ({
  mockApplyFilter: vi.fn(),
  mockRemoveFilter: vi.fn(),
}));

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    applyFilter: mockApplyFilter,
    removeFilter: mockRemoveFilter,
  },
}));

// node-ptyモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// drizzle-ormモック
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((col) => ({ isNull: col })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
}));

// scrollback-bufferモック
vi.mock('@/services/scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    clear: vi.fn(),
  },
}));

// loggerモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// DockerClientモック
const mockContainer = {
  attach: vi.fn(),
  start: vi.fn(),
  exec: vi.fn(),
  inspect: vi.fn(),
  stop: vi.fn(),
  kill: vi.fn(),
  wait: vi.fn(),
  remove: vi.fn(),
};

const mockDockerClient = {
  createContainer: vi.fn(),
  getContainer: vi.fn(),
  inspectContainer: vi.fn(),
};

vi.mock('../../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// DockerPTYStreamモック
const mockPTYStreamInstance = new EventEmitter() as any;
mockPTYStreamInstance.setStream = vi.fn();
mockPTYStreamInstance.resize = vi.fn();
mockPTYStreamInstance.write = vi.fn();
mockPTYStreamInstance.kill = vi.fn();
mockPTYStreamInstance.onData = vi.fn((cb: (data: string) => void) =>
  mockPTYStreamInstance.on('data', cb)
);
mockPTYStreamInstance.onExit = vi.fn((cb: (info: unknown) => void) =>
  mockPTYStreamInstance.on('exit', cb)
);

vi.mock('../../docker-pty-stream', () => ({
  DockerPTYStream: class {
    constructor() {
      return mockPTYStreamInstance;
    }
  },
}));

// DBモック
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn().mockReturnValue([]),
        })),
        all: vi.fn().mockReturnValue([]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
        })),
      })),
    })),
  },
  schema: { sessions: {}, sshKeys: {} },
}));

// その他サービスモック
vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: class {
    getEffectiveSettings = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: class {
    decrypt = vi.fn().mockResolvedValue('decrypted');
  },
}));

// fsモック
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { DockerAdapter } from '../docker-adapter';
import { logger } from '@/lib/logger';

describe('DockerAdapter フィルタリング統合', () => {
  let adapter: DockerAdapter;
  const mockStream = new EventEmitter() as any;
  mockStream.write = vi.fn();
  mockStream.end = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトモック設定
    mockDockerClient.createContainer.mockResolvedValue(mockContainer);
    mockDockerClient.getContainer.mockReturnValue(mockContainer);
    mockDockerClient.inspectContainer.mockResolvedValue({ State: { Running: true } });
    mockContainer.attach.mockResolvedValue(mockStream);
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.stop.mockResolvedValue(undefined);
    mockContainer.remove.mockResolvedValue(undefined);
    mockContainer.inspect.mockResolvedValue({ State: { Running: true } });
    mockContainer.exec.mockResolvedValue({
      start: vi.fn().mockResolvedValue(mockStream),
      resize: vi.fn(),
      inspect: vi.fn(),
    });

    // フィルタリングサービスのデフォルト（成功）
    mockApplyFilter.mockResolvedValue(undefined);
    mockRemoveFilter.mockResolvedValue(undefined);

    adapter = new DockerAdapter({
      environmentId: 'env-test-1234',
      imageName: 'test-image',
      imageTag: 'latest',
      authDirPath: '/data/environments/env-test-1234',
    });
  });

  // =========================================================
  // createSession: フィルタリング統合テスト
  // =========================================================

  describe('createSession', () => {
    it('フィルタリング有効時にapplyFilterが呼ばれる', async () => {
      await adapter.createSession('session-1', '/workspace');

      expect(mockApplyFilter).toHaveBeenCalledTimes(1);
      expect(mockApplyFilter).toHaveBeenCalledWith('env-test-1234', '172.17.0.0/16');
    });

    it('フィルタリング無効時（applyFilterがノーオペレーション）にコンテナが起動する', async () => {
      // applyFilter は無効時に何もしないのでresolveするだけ（サービス内部で判断）
      mockApplyFilter.mockResolvedValue(undefined);

      await adapter.createSession('session-1', '/workspace');

      // applyFilterは常に呼ばれるが、サービス内部でフィルタリング無効を判断してスキップする
      // コンテナは正常に起動する
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('applyFilter失敗時にコンテナ起動が中止される', async () => {
      const filterError = new Error('iptables not available');
      mockApplyFilter.mockRejectedValue(filterError);

      await expect(adapter.createSession('session-1', '/workspace')).rejects.toThrow(
        'iptables not available'
      );

      // コンテナが削除またはクリーンアップされていること
      // container.start()は呼ばれていないか、もしくは呼ばれた後コンテナが削除されている
      // 実装に応じて検証: removeが呼ばれるはず
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('applyFilter失敗時にエラーがログに記録される', async () => {
      const filterError = new Error('Filter setup failed');
      mockApplyFilter.mockRejectedValue(filterError);

      await expect(adapter.createSession('session-1', '/workspace')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Network filter'),
        expect.objectContaining({
          sessionId: 'session-1',
          error: filterError,
        })
      );
    });

    it('コンテナが正常に起動した後にapplyFilterが呼ばれる（起動順序）', async () => {
      const callOrder: string[] = [];
      mockContainer.start.mockImplementation(async () => {
        callOrder.push('container.start');
      });
      mockApplyFilter.mockImplementation(async () => {
        callOrder.push('applyFilter');
      });

      await adapter.createSession('session-1', '/workspace');

      const startIndex = callOrder.indexOf('container.start');
      const filterIndex = callOrder.indexOf('applyFilter');
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(filterIndex).toBeGreaterThanOrEqual(0);
      expect(filterIndex).toBeGreaterThan(startIndex);
    });
  });

  // =========================================================
  // destroySession: フィルタリングクリーンアップテスト
  // =========================================================

  describe('destroySession', () => {
    it('destroySession時にremoveFilterが呼ばれる', async () => {
      // セッション作成
      await adapter.createSession('session-1', '/workspace');

      // セッション破棄
      await adapter.destroySession('session-1');

      expect(mockRemoveFilter).toHaveBeenCalledWith('env-test-1234');
    });

    it('removeFilter失敗時は警告ログのみ（セッション破棄は続行）', async () => {
      mockRemoveFilter.mockRejectedValue(new Error('Cleanup failed'));

      // セッション作成
      await adapter.createSession('session-1', '/workspace');

      // セッション破棄はエラーを投げない
      await expect(adapter.destroySession('session-1')).resolves.toBeUndefined();

      // 警告ログが出力されている
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Network filter cleanup failed'),
        expect.objectContaining({
          sessionId: 'session-1',
        })
      );
    });

    it('removeFilter失敗時もコンテナ停止処理は続行される', async () => {
      mockRemoveFilter.mockRejectedValue(new Error('Cleanup failed'));

      await adapter.createSession('session-1', '/workspace');
      await adapter.destroySession('session-1');

      // PTYのkillが呼ばれている（セッション破棄続行の証拠）
      expect(mockPTYStreamInstance.kill).toHaveBeenCalled();
    });
  });

  // =========================================================
  // buildContainerOptions: ネットワーク設定テスト
  // =========================================================

  describe('buildContainerOptions', () => {
    it('CapDrop[ALL]が維持されている', async () => {
      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.HostConfig.CapDrop).toContain('ALL');
    });

    it('コンテナ作成オプションにImageが含まれる', async () => {
      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Image).toBe('test-image:latest');
    });

    it('コンテナ作成オプションにTtyが含まれる', async () => {
      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Tty).toBe(true);
    });
  });

  // =========================================================
  // 既存テストの継続確認
  // =========================================================

  describe('既存createSessionテストが引き続きパス', () => {
    it('コンテナを作成してPTYストリームをアタッチする', async () => {
      await adapter.createSession('session-existing', '/workspace');

      expect(mockDockerClient.createContainer).toHaveBeenCalled();
      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Image).toBe('test-image:latest');
      expect(createOptions.Tty).toBe(true);

      expect(mockContainer.attach).toHaveBeenCalledWith(
        expect.objectContaining({
          hijack: true,
          stream: true,
        })
      );

      expect(mockContainer.start).toHaveBeenCalled();
      expect(mockPTYStreamInstance.setStream).toHaveBeenCalledWith(mockStream);
    });

    it('カスタム環境変数を設定できる', async () => {
      await adapter.createSession('session-existing', '/workspace', undefined, {
        customEnvVars: { TEST_VAR: 'value' },
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('TEST_VAR=value');
    });
  });
});
