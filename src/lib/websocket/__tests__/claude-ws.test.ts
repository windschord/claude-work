import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted()でモックを先に定義
const {
  mockClaudePtyManager,
  mockDb,
  mockEnvironmentService,
  mockAdapterFactory,
  createMockAdapter,
} = vi.hoisted(() => {
  // EventEmitter をモック内で直接使わず、シンプルなモックオブジェクトを使用
  const createMockAdapterFn = () => ({
    createSession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    destroySession: vi.fn(),
    restartSession: vi.fn(),
    hasSession: vi.fn().mockReturnValue(false),
    getWorkingDir: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  });

  return {
    mockClaudePtyManager: {
      createSession: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      destroySession: vi.fn(),
      restartSession: vi.fn(),
      hasSession: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      off: vi.fn(),
    },
    mockDb: {
      query: {
        sessions: {
          findFirst: vi.fn(),
        },
        messages: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn(),
          }),
        }),
      }),
    },
    mockEnvironmentService: {
      findById: vi.fn(),
      getDefault: vi.fn(),
    },
    mockAdapterFactory: {
      getAdapter: vi.fn(),
      reset: vi.fn(),
    },
    createMockAdapter: createMockAdapterFn,
  };
});

// モジュールモック
vi.mock('@/services/claude-pty-manager', () => ({
  claudePtyManager: mockClaudePtyManager,
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {
    sessions: {},
    messages: {},
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/environment-service', () => ({
  environmentService: mockEnvironmentService,
}));

vi.mock('@/services/adapter-factory', () => ({
  AdapterFactory: mockAdapterFactory,
}));

// テスト対象をインポート
import { setupClaudeWebSocket } from '../claude-ws';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Claude WebSocket Handler のテスト
 *
 * TASK-EE-012: ClaudeWebSocketHandlerの環境対応
 *
 * テスト対象:
 * 1. environment_id指定時 → AdapterFactory.getAdapter(env) を使用
 * 2. docker_mode=true かつ environment_id未指定 → レガシー動作（claudePtyManager直接使用）
 * 3. 両方未指定 → デフォルト環境（EnvironmentService.getDefault()経由）
 */
describe('Claude WebSocket Handler - Environment Support', () => {
  let mockWss: WebSocketServer;
  let mockWs: WebSocket;
  let connectionHandler: (ws: WebSocket, req: { url: string; headers: { host: string } }) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // WebSocketServer のモック
    mockWss = {
      on: vi.fn((event, handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
    } as unknown as WebSocketServer;

    // WebSocket のモック
    mockWs = {
      readyState: WebSocket.OPEN,
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    } as unknown as WebSocket;

    // デフォルトのモック設定
    mockDb.query.messages.findFirst.mockResolvedValue(null);

    // db.update チェーンを再設定（resetAllMocksで壊れるため）
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn(),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('environment_id specified', () => {
    it('should use AdapterFactory when session has environment_id', async () => {
      const sessionId = 'session-with-env-id';
      const environmentId = 'env-docker-1';
      const mockEnvironment = {
        id: environmentId,
        name: 'Docker Env',
        type: 'DOCKER',
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // セッション（environment_idあり）
      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue(mockEnvironment);

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      // WebSocketハンドラーをセットアップ
      setupClaudeWebSocket(mockWss, '/ws/claude');

      // 接続をシミュレート
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // AdapterFactory.getAdapter が呼ばれることを確認
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith(environmentId);
      expect(mockAdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnvironment);
      expect(mockAdapter.createSession).toHaveBeenCalledWith(
        sessionId,
        '/path/to/worktree',
        undefined, // 初期プロンプトなし
        expect.any(Object)
      );
      // レガシーのclaudePtyManagerは呼ばれない
      expect(mockClaudePtyManager.createSession).not.toHaveBeenCalled();
    });

    it('should use HOST adapter for HOST environment', async () => {
      const sessionId = 'session-host-env';
      const environmentId = 'host-custom';
      const mockEnvironment = {
        id: environmentId,
        name: 'Custom Host',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue(mockEnvironment);

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      expect(mockAdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnvironment);
    });
  });

  describe('legacy dockerMode support', () => {
    it('should use claudePtyManager directly when docker_mode=true without environment_id', async () => {
      const sessionId = 'session-legacy-docker';

      // docker_mode=true, environment_id=null（レガシー動作）
      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: true,
        environment_id: null,
      });

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // レガシーのclaudePtyManagerが呼ばれる
      expect(mockClaudePtyManager.createSession).toHaveBeenCalledWith(
        sessionId,
        '/path/to/worktree',
        undefined,
        { dockerMode: true }
      );
      // AdapterFactoryは呼ばれない
      expect(mockAdapterFactory.getAdapter).not.toHaveBeenCalled();
    });
  });

  describe('default environment', () => {
    it('should use default environment when neither environment_id nor docker_mode specified', async () => {
      const sessionId = 'session-default';
      const defaultEnvironment = {
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: null,
      });

      mockEnvironmentService.getDefault.mockResolvedValue(defaultEnvironment);

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // デフォルト環境を取得
      expect(mockEnvironmentService.getDefault).toHaveBeenCalled();
      expect(mockAdapterFactory.getAdapter).toHaveBeenCalledWith(defaultEnvironment);
      expect(mockAdapter.createSession).toHaveBeenCalled();
    });
  });

  describe('adapter event handling', () => {
    it('should register event handlers on adapter', async () => {
      const sessionId = 'session-events';
      const environmentId = 'env-events';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue({
        id: environmentId,
        name: 'Test Env',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // アダプターにイベントハンドラーが登録されることを確認
      expect(mockAdapter.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('claudeSessionId', expect.any(Function));
    });

    it('should forward input messages to adapter', async () => {
      const sessionId = 'session-input';
      const environmentId = 'env-input';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue({
        id: environmentId,
        name: 'Test Env',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      // メッセージハンドラーをキャプチャ
      let messageHandler: (message: Buffer) => void;
      mockWs.on = vi.fn((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      }) as WebSocket['on'];

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // 入力メッセージをシミュレート
      const inputMessage = JSON.stringify({ type: 'input', data: 'test input' });
      messageHandler!(Buffer.from(inputMessage));

      expect(mockAdapter.write).toHaveBeenCalledWith(sessionId, 'test input');
    });

    it('should forward resize messages to adapter', async () => {
      const sessionId = 'session-resize';
      const environmentId = 'env-resize';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue({
        id: environmentId,
        name: 'Test Env',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      let messageHandler: (message: Buffer) => void;
      mockWs.on = vi.fn((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      }) as WebSocket['on'];

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      const resizeMessage = JSON.stringify({ type: 'resize', data: { cols: 120, rows: 40 } });
      messageHandler!(Buffer.from(resizeMessage));

      expect(mockAdapter.resize).toHaveBeenCalledWith(sessionId, 120, 40);
    });

    it('should cleanup event handlers on close', async () => {
      const sessionId = 'session-close';
      const environmentId = 'env-close';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue({
        id: environmentId,
        name: 'Test Env',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const mockAdapter = createMockAdapter();
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      let closeHandler: () => void;
      mockWs.on = vi.fn((event, handler) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      }) as WebSocket['on'];

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // close イベントをシミュレート
      closeHandler!();

      // イベントハンドラーが解除されることを確認
      expect(mockAdapter.off).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockAdapter.off).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockAdapter.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAdapter.off).toHaveBeenCalledWith('claudeSessionId', expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should handle environment not found error', async () => {
      const sessionId = 'session-no-env';
      const environmentId = 'non-existent-env';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue(null);

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      // エラーメッセージが送信されることを確認
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should handle default environment not found error', async () => {
      const sessionId = 'session-no-default';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: '/path/to/worktree',
        docker_mode: false,
        environment_id: null,
      });

      mockEnvironmentService.getDefault.mockRejectedValue(
        new Error('デフォルト環境が見つかりません')
      );

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe('restart handling', () => {
    it('should pass worktree_path to restartSession for adapter', async () => {
      const sessionId = 'session-restart';
      const environmentId = 'env-restart';
      const worktreePath = '/path/to/worktree';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: worktreePath,
        docker_mode: false,
        environment_id: environmentId,
      });

      mockEnvironmentService.findById.mockResolvedValue({
        id: environmentId,
        name: 'Test Env',
        type: 'HOST',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const mockAdapter = createMockAdapter();
      mockAdapter.hasSession.mockReturnValue(true);
      mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);

      let messageHandler: (message: Buffer) => void;
      mockWs.on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'message') {
          messageHandler = handler as (message: Buffer) => void;
        }
      }) as WebSocket['on'];

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      const restartMessage = JSON.stringify({ type: 'restart' });
      messageHandler!(Buffer.from(restartMessage));

      expect(mockAdapter.restartSession).toHaveBeenCalledWith(sessionId, worktreePath);
    });

    it('should pass worktree_path to restartSession for legacy mode', async () => {
      const sessionId = 'session-restart-legacy';
      const worktreePath = '/path/to/worktree-legacy';

      mockDb.query.sessions.findFirst.mockResolvedValue({
        id: sessionId,
        worktree_path: worktreePath,
        docker_mode: true,
        environment_id: null,
      });

      mockClaudePtyManager.hasSession.mockReturnValue(true);

      let messageHandler: (message: Buffer) => void;
      mockWs.on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'message') {
          messageHandler = handler as (message: Buffer) => void;
        }
      }) as WebSocket['on'];

      setupClaudeWebSocket(mockWss, '/ws/claude');
      await connectionHandler(mockWs, {
        url: `/ws/claude/${sessionId}`,
        headers: { host: 'localhost:3000' },
      });

      const restartMessage = JSON.stringify({ type: 'restart' });
      messageHandler!(Buffer.from(restartMessage));

      expect(mockClaudePtyManager.restartSession).toHaveBeenCalledWith(
        sessionId,
        worktreePath,
        undefined,
        { dockerMode: true }
      );
    });
  });
});
