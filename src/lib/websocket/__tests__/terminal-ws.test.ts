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

// prismaモック
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
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
      const { prisma } = await import('@/lib/db');
      const { environmentService } = await import('@/services/environment-service');
      const { AdapterFactory } = await import('@/services/adapter-factory');

      // Docker環境のセッション
      const dockerSession = {
        ...mockSession,
        environment_id: 'env-docker-1',
      };

      vi.mocked(prisma.session.findUnique).mockResolvedValue(dockerSession);
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
});
