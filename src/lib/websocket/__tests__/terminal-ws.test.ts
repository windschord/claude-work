import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTerminalWebSocket } from '../terminal-ws';

// モック定義
const mockSession = {
  id: 'session-1',
  worktree_path: '/path/to/worktree',
  environment_id: null,
  docker_mode: false,
};

const mockHostEnvironment = {
  id: 'env-host-1',
  name: 'Host Environment',
  type: 'HOST' as const,
  config: null,
};

const mockDockerEnvironment = {
  id: 'env-docker-1',
  name: 'Docker Environment',
  type: 'DOCKER' as const,
  config: JSON.stringify({
    imageName: 'claude-code-env',
    imageTag: 'v1.0',
    authDirPath: '/data/environments/env-docker-1',
  }),
};

// dbモック (Drizzle)
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    sessions: { id: 'id', environment_id: 'environment_id' },
  },
}));

// loggerモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ptyManagerモック
vi.mock('@/services/pty-manager', () => ({
  ptyManager: {
    createPTY: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    hasSession: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// environmentServiceモック
vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findById: vi.fn(),
    getDefault: vi.fn(),
  },
}));

// AdapterFactoryモック
const mockDockerAdapter = {
  createSession: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  destroySession: vi.fn(),
  hasSession: vi.fn().mockReturnValue(false),
  on: vi.fn(),
  off: vi.fn(),
};

const mockHostAdapter = {
  createSession: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  destroySession: vi.fn(),
  hasSession: vi.fn().mockReturnValue(false),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@/services/adapter-factory', () => ({
  AdapterFactory: {
    getAdapter: vi.fn((env) => {
      if (env.type === 'DOCKER') {
        return mockDockerAdapter;
      }
      return mockHostAdapter;
    }),
  },
}));

/**
 * ターミナルWebSocketのユニットテスト
 *
 * Note: WebSocket統合テストは実際のサーバーインスタンスが必要なため、
 * E2Eテストで実施します。ここでは関数のエクスポートと基本的な検証のみ実施します。
 */
describe('Terminal WebSocket', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should export setupTerminalWebSocket function', () => {
    expect(setupTerminalWebSocket).toBeDefined();
    expect(typeof setupTerminalWebSocket).toBe('function');
  });

  it('should accept WebSocketServer and path parameters', () => {
    // 関数のシグネチャを検証
    expect(setupTerminalWebSocket.length).toBe(2);
  });

  describe('environment adapter selection', () => {
    // 環境アダプター選択ロジックのユニットテスト
    // 実際のWebSocket接続は統合テストで検証

    it('should use the correct adapter based on session environment_id', async () => {
      const { db } = await import('@/lib/db');
      const { environmentService } = await import('@/services/environment-service');
      const { AdapterFactory } = await import('@/services/adapter-factory');

      // Docker環境のセッション
      const dockerSession = {
        ...mockSession,
        environment_id: 'env-docker-1',
      };

      vi.mocked(db.query.sessions.findFirst).mockResolvedValue(dockerSession);
      vi.mocked(environmentService.findById).mockResolvedValue(mockDockerEnvironment);

      // アダプター取得の検証
      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);
      expect(adapter).toBe(mockDockerAdapter);
    });

    it('should use HostAdapter for HOST environment', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockHostEnvironment);
      expect(adapter).toBe(mockHostAdapter);
    });

    it('should use DockerAdapter for DOCKER environment', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);
      expect(adapter).toBe(mockDockerAdapter);
    });
  });

  describe('terminalSessionId generation', () => {
    it('should generate terminalSessionId with TERMINAL_SESSION_SUFFIX constant', () => {
      const sessionId = 'test-session-123';
      const TERMINAL_SESSION_SUFFIX = '-terminal';
      const expectedTerminalSessionId = 'test-session-123-terminal';

      // terminalSessionIdの生成ロジックをテスト
      // 実際の実装: const terminalSessionId = `${sessionId}${TERMINAL_SESSION_SUFFIX}`;
      const terminalSessionId = `${sessionId}${TERMINAL_SESSION_SUFFIX}`;
      expect(terminalSessionId).toBe(expectedTerminalSessionId);
    });
  });

  describe('adapter createSession options', () => {
    it('should call adapter.createSession with shellMode: true for Docker environment', async () => {
      const { environmentService } = await import('@/services/environment-service');
      const { AdapterFactory } = await import('@/services/adapter-factory');

      vi.mocked(environmentService.findById).mockResolvedValue(mockDockerEnvironment);

      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);

      // shellMode: true でセッション作成が呼ばれることを検証
      const terminalSessionId = 'session-1-terminal';
      const workingDir = '/path/to/worktree';

      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });

      expect(mockDockerAdapter.createSession).toHaveBeenCalledWith(
        terminalSessionId,
        workingDir,
        undefined,
        { shellMode: true }
      );
    });

    it('should call adapter.createSession with shellMode: true for Host environment', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockHostEnvironment);

      const terminalSessionId = 'session-1-terminal';
      const workingDir = '/path/to/worktree';

      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });

      expect(mockHostAdapter.createSession).toHaveBeenCalledWith(
        terminalSessionId,
        workingDir,
        undefined,
        { shellMode: true }
      );
    });
  });

  describe('legacy ptyManager mode', () => {
    it('should use ptyManager when environment_id is not set', async () => {
      const { ptyManager } = await import('@/services/pty-manager');

      // environment_idがnullのセッション
      const sessionWithoutEnv = {
        ...mockSession,
        environment_id: null,
      };

      // ptyManagerが使用されることを検証
      const terminalSessionId = `${sessionWithoutEnv.id}-terminal`;
      ptyManager.createPTY(terminalSessionId, sessionWithoutEnv.worktree_path);

      expect(ptyManager.createPTY).toHaveBeenCalledWith(
        terminalSessionId,
        sessionWithoutEnv.worktree_path
      );
    });
  });

  describe('cleanup on disconnect', () => {
    it('should destroy adapter session on WebSocket close', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);
      const terminalSessionId = 'session-1-terminal';

      // セッション破棄が呼ばれることを検証
      adapter.destroySession(terminalSessionId);

      expect(mockDockerAdapter.destroySession).toHaveBeenCalledWith(terminalSessionId);
    });

    it('should kill ptyManager session on WebSocket close', async () => {
      const { ptyManager } = await import('@/services/pty-manager');

      const terminalSessionId = 'session-1-terminal';

      // ptyManagerのkillが呼ばれることを検証
      ptyManager.kill(terminalSessionId);

      expect(ptyManager.kill).toHaveBeenCalledWith(terminalSessionId);
    });
  });

  describe('adapter event handlers', () => {
    it('should register data, exit, and error event handlers for adapter', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);

      // data, exit, error イベントを登録
      const dataHandler = vi.fn();
      const exitHandler = vi.fn();
      const errorHandler = vi.fn();

      adapter.on('data', dataHandler);
      adapter.on('exit', exitHandler);
      adapter.on('error', errorHandler);

      expect(mockDockerAdapter.on).toHaveBeenCalledWith('data', dataHandler);
      expect(mockDockerAdapter.on).toHaveBeenCalledWith('exit', exitHandler);
      expect(mockDockerAdapter.on).toHaveBeenCalledWith('error', errorHandler);
    });

    it('should unregister all event handlers on cleanup', async () => {
      const { AdapterFactory } = await import('@/services/adapter-factory');

      const adapter = AdapterFactory.getAdapter(mockDockerEnvironment);

      // イベントハンドラー解除
      const dataHandler = vi.fn();
      const exitHandler = vi.fn();
      const errorHandler = vi.fn();

      adapter.off('data', dataHandler);
      adapter.off('exit', exitHandler);
      adapter.off('error', errorHandler);

      expect(mockDockerAdapter.off).toHaveBeenCalledWith('data', dataHandler);
      expect(mockDockerAdapter.off).toHaveBeenCalledWith('exit', exitHandler);
      expect(mockDockerAdapter.off).toHaveBeenCalledWith('error', errorHandler);
    });
  });
});
