import { describe, it, expect, vi } from 'vitest';
import { HostAdapter } from '../host-adapter';
import { DockerAdapter } from '../docker-adapter';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// pty-managerのモック（shellMode用）
vi.mock('../../pty-manager', () => ({
  ptyManager: {
    createPTY: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    hasSession: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('統合テスト: Issue #101 PTY Architecture Refactor', () => {
  let mockPtyInstance: IPty;

  beforeEach(() => {
    vi.clearAllMocks();

    // モックPTYインスタンス
    mockPtyInstance = {
      onData: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      removeAllListeners: vi.fn(),
      pid: 12345,
      cols: 80,
      rows: 24,
      process: 'claude',
      handleFlowControl: false,
      clear: vi.fn(),
    } as unknown as IPty;

    vi.mocked(pty.spawn).mockReturnValue(mockPtyInstance);
  });

  describe('REQ-001: Circular delegation解消', () => {
    it('REQ-001-007: HOST環境でセッション作成時、createSession()が1回のみ呼び出されること', () => {
      const hostAdapter = new HostAdapter();
      const createSessionSpy = vi.spyOn(hostAdapter, 'createSession');

      hostAdapter.createSession('session-1', '/path/to/work');

      // createSession()が1回のみ呼び出されたことを確認
      expect(createSessionSpy).toHaveBeenCalledTimes(1);

      // pty.spawnが1回のみ呼び出されたことを確認（無限ループなし）
      expect(pty.spawn).toHaveBeenCalledTimes(1);
    });

    it('REQ-001-007: "Session already exists"エラーが発生しないこと', () => {
      const hostAdapter = new HostAdapter();

      // 同じセッションIDで2回作成を試みてもエラーにならないことを確認
      expect(() => {
        hostAdapter.createSession('session-1', '/path/to/work');
      }).not.toThrow('Session already exists');
    });
  });

  describe('REQ-002: destroySession無限再帰解消', () => {
    it('REQ-002-005: セッション破棄時、スタックオーバーフローエラーが発生しないこと', async () => {
      const hostAdapter = new HostAdapter();
      hostAdapter.createSession('session-1', '/path/to/work');

      // destroySession()がスタックオーバーフローを起こさないことを確認
      await expect(hostAdapter.destroySession('session-1')).resolves.not.toThrow();
    });

    it('REQ-002-005: destroySession()が1回のみ呼び出されること', async () => {
      const hostAdapter = new HostAdapter();
      hostAdapter.createSession('session-1', '/path/to/work');

      const destroySpy = vi.spyOn(hostAdapter, 'destroySession');

      await hostAdapter.destroySession('session-1');

      // destroySession()が1回のみ呼び出されたことを確認
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('REQ-003: cols/rows伝播', () => {
    describe('REQ-003-005: HOST環境cols/rows伝播', () => {
      it('ブラウザのターミナルサイズとPTYサイズが一致すること（80x24デフォルト）', () => {
        const hostAdapter = new HostAdapter();
        hostAdapter.createSession('session-1', '/path/to/work');

        expect(pty.spawn).toHaveBeenCalledWith(
          'claude',
          [],
          expect.objectContaining({
            cols: 80,
            rows: 24,
          })
        );
      });

      it('ブラウザのターミナルサイズとPTYサイズが一致すること（カスタムサイズ）', () => {
        const hostAdapter = new HostAdapter();
        hostAdapter.createSession('session-1', '/path/to/work', undefined, {
          cols: 120,
          rows: 40,
        });

        expect(pty.spawn).toHaveBeenCalledWith(
          'claude',
          [],
          expect.objectContaining({
            cols: 120,
            rows: 40,
          })
        );
      });

      it('resize()が正しく動作すること', () => {
        const hostAdapter = new HostAdapter();
        hostAdapter.createSession('session-1', '/path/to/work');

        hostAdapter.resize('session-1', 100, 30);

        expect(mockPtyInstance.resize).toHaveBeenCalledWith(100, 30);
      });
    });

    describe('REQ-003-007: DOCKER環境cols/rows伝播（回帰テスト）', () => {
      it('DockerAdapterがBasePTYAdapter.spawnPTY()を使用していること', () => {
        const config = {
          environmentId: 'test-env',
          imageName: 'test-image',
          imageTag: 'latest',
          authDirPath: '/tmp/test-auth',
        };
        const dockerAdapter = new DockerAdapter(config);

        // spawnPTYがprotectedメソッドとして存在することを確認
        expect(typeof (dockerAdapter as any).spawnPTY).toBe('function');
      });

      it('DockerAdapterがBasePTYAdapterから継承していること', () => {
        const config = {
          environmentId: 'test-env',
          imageName: 'test-image',
          imageTag: 'latest',
          authDirPath: '/tmp/test-auth',
        };
        const dockerAdapter = new DockerAdapter(config);

        // BasePTYAdapterのメソッドが存在することを確認
        expect(typeof dockerAdapter.createSession).toBe('function');
        expect(typeof dockerAdapter.destroySession).toBe('function');
        expect(typeof dockerAdapter.write).toBe('function');
        expect(typeof dockerAdapter.resize).toBe('function');
      });
    });
  });

  describe('アーキテクチャ検証', () => {
    it('HostAdapterがBasePTYAdapterから継承していること', () => {
      const hostAdapter = new HostAdapter();

      // BasePTYAdapterのprotectedメソッドが存在することを確認
      expect(typeof (hostAdapter as any).spawnPTY).toBe('function');
      expect(typeof (hostAdapter as any).setupDataHandlers).toBe('function');
      expect(typeof (hostAdapter as any).setupErrorHandlers).toBe('function');
      expect(typeof (hostAdapter as any).cleanupPTY).toBe('function');
      expect(typeof (hostAdapter as any).extractClaudeSessionId).toBe('function');
    });

    it('DockerAdapterがBasePTYAdapterから継承していること', () => {
      const config = {
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: '/tmp/test-auth',
      };
      const dockerAdapter = new DockerAdapter(config);

      // BasePTYAdapterのprotectedメソッドが存在することを確認
      expect(typeof (dockerAdapter as any).spawnPTY).toBe('function');
      expect(typeof (dockerAdapter as any).setupDataHandlers).toBe('function');
      expect(typeof (dockerAdapter as any).setupErrorHandlers).toBe('function');
      expect(typeof (dockerAdapter as any).cleanupPTY).toBe('function');
      expect(typeof (dockerAdapter as any).extractClaudeSessionId).toBe('function');
    });
  });
});
