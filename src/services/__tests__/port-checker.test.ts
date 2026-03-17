import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// net モジュールのモック（vi.hoisted で先に定義）
const { mockCreateServer } = vi.hoisted(() => ({
  mockCreateServer: vi.fn(),
}));

vi.mock('net', () => ({
  default: {
    createServer: mockCreateServer,
  },
  createServer: mockCreateServer,
}));

// DB モック
const {
  mockDbSelectAll,
} = vi.hoisted(() => ({
  mockDbSelectAll: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: mockDbSelectAll,
        })),
      })),
    })),
  },
  schema: {
    executionEnvironments: {
      id: 'id',
      type: 'type',
      name: 'name',
      config: 'config',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// テスト対象をインポート
import { PortChecker } from '../port-checker';

/**
 * net.createServer のモックサーバーを生成するヘルパー
 * listen 成功時のサーバーを返す
 */
function createMockServerSuccess(): EventEmitter & {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const server = new EventEmitter() as EventEmitter & {
    listen: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  server.listen = vi.fn((_port: number, _host: string, callback: () => void) => {
    // 非同期でlistenイベントを発火
    process.nextTick(() => {
      callback();
    });
    return server;
  });
  server.close = vi.fn((callback?: () => void) => {
    if (callback) process.nextTick(callback);
    return server;
  });
  return server;
}

/**
 * net.createServer のモックサーバーを生成するヘルパー
 * listen 失敗時（エラーあり）のサーバーを返す
 */
function createMockServerError(errorCode: string): EventEmitter & {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const server = new EventEmitter() as EventEmitter & {
    listen: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  server.listen = vi.fn((_port: number, _host: string, _callback: () => void) => {
    process.nextTick(() => {
      const err = new Error(`Port error: ${errorCode}`);
      (err as NodeJS.ErrnoException).code = errorCode;
      server.emit('error', err);
    });
    return server;
  });
  server.close = vi.fn((callback?: () => void) => {
    if (callback) process.nextTick(callback);
    return server;
  });
  return server;
}

describe('PortChecker', () => {
  let portChecker: PortChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    portChecker = new PortChecker();
  });

  describe('checkHostPort', () => {
    it('ポートが空いている場合はavailableを返す', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);

      const result = await portChecker.checkHostPort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('available');
      expect(result.source).toBeUndefined();
    });

    it('ポートが使用中の場合はin_use (source: os) を返す', async () => {
      const mockServer = createMockServerError('EADDRINUSE');
      mockCreateServer.mockReturnValue(mockServer);

      const result = await portChecker.checkHostPort(3000);

      expect(result.port).toBe(3000);
      expect(result.status).toBe('in_use');
      expect(result.source).toBe('os');
    });

    it('権限不足の場合はunknownを返す', async () => {
      const mockServer = createMockServerError('EACCES');
      mockCreateServer.mockReturnValue(mockServer);

      const result = await portChecker.checkHostPort(80);

      expect(result.port).toBe(80);
      expect(result.status).toBe('unknown');
      expect(result.source).toBeUndefined();
    });

    it('タイムアウト時はunknownを返す', async () => {
      vi.useFakeTimers();
      // listen もerror も発火しないサーバー
      const server = new EventEmitter() as EventEmitter & {
        listen: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      };
      server.listen = vi.fn(() => server);
      server.close = vi.fn((callback?: () => void) => {
        if (callback) process.nextTick(callback);
        return server;
      });
      mockCreateServer.mockReturnValue(server);

      const resultPromise = portChecker.checkHostPort(8080);
      vi.advanceTimersByTime(500);
      // process.nextTickを処理するためにawait
      await vi.advanceTimersByTimeAsync(0);
      const result = await resultPromise;

      expect(result.port).toBe(8080);
      expect(result.status).toBe('unknown');
      vi.useRealTimers();
    });
  });

  describe('checkClaudeWorkPorts', () => {
    it('他環境で使用中のポートを検出してin_use (source: claudework) を返す', async () => {
      const envName = 'MyDockerEnv';
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-other',
          name: envName,
          type: 'DOCKER',
          config: JSON.stringify({
            portMappings: [
              { hostPort: 8080, containerPort: 80 },
            ],
          }),
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([8080]);

      expect(results).toHaveLength(1);
      expect(results[0].port).toBe(8080);
      expect(results[0].status).toBe('in_use');
      expect(results[0].source).toBe('claudework');
      expect(results[0].usedBy).toBe(envName);
    });

    it('excludeEnvironmentIdで自環境を除外して競合なしを返す', async () => {
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-self',
          name: 'SelfEnv',
          type: 'DOCKER',
          config: JSON.stringify({
            portMappings: [
              { hostPort: 8080, containerPort: 80 },
            ],
          }),
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([8080], 'env-self');

      expect(results).toHaveLength(1);
      expect(results[0].port).toBe(8080);
      expect(results[0].status).toBe('available');
    });

    it('DB取得失敗時は全ポートをunknownで返す', async () => {
      mockDbSelectAll.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const results = await portChecker.checkClaudeWorkPorts([8080, 9000]);

      expect(results).toHaveLength(2);
      expect(results[0].port).toBe(8080);
      expect(results[0].status).toBe('unknown');
      expect(results[1].port).toBe(9000);
      expect(results[1].status).toBe('unknown');
    });

    it('環境のconfigが不正なJSONの場合、未検出ポートはunknownにフォールバック', async () => {
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-bad-json',
          name: 'BadJsonEnv',
          type: 'DOCKER',
          config: 'invalid-json{',
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([9000]);

      expect(results).toHaveLength(1);
      expect(results[0].port).toBe(9000);
      expect(results[0].status).toBe('unknown');
    });

    it('環境のconfigがnullの場合もフォールバックする', async () => {
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-null-config',
          name: 'NullConfigEnv',
          type: 'DOCKER',
          config: null,
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([9000]);

      expect(results).toHaveLength(1);
      // configがnullの場合、JSON.parse(null || '{}')は '{}'を解析 -> portMappings undefined -> available
      expect(results[0].status).toBe('available');
    });

    it('portMappingsがundefinedの環境はスキップする', async () => {
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-no-mappings',
          name: 'NoMappingsEnv',
          type: 'DOCKER',
          config: JSON.stringify({}),
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([9000]);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('available');
    });

    it('他環境にポートマッピングがない場合はavailableを返す', async () => {
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-other',
          name: 'OtherEnv',
          type: 'DOCKER',
          config: JSON.stringify({
            portMappings: [],
          }),
        },
      ]);

      const results = await portChecker.checkClaudeWorkPorts([9000]);

      expect(results).toHaveLength(1);
      expect(results[0].port).toBe(9000);
      expect(results[0].status).toBe('available');
    });
  });

  describe('checkSinglePort', () => {
    it('ClaudeWorkでunknownの場合はunknownを返す', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      // DB取得失敗でunknownが返る
      mockDbSelectAll.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const result = await portChecker.checkSinglePort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('unknown');
    });

    it('OSで利用可能かつClaudeWorkでin_useの場合、in_useを返す', async () => {
      // OS: available
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      // CW: in_use
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-other',
          name: 'OtherEnv',
          type: 'DOCKER',
          config: JSON.stringify({
            portMappings: [{ hostPort: 8080, containerPort: 80 }],
          }),
        },
      ]);

      const result = await portChecker.checkSinglePort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('in_use');
      expect(result.source).toBe('claudework');
    });

    it('OSでin_useの場合はClaudeWork結果に関わらずin_useを返す', async () => {
      // OS: in_use
      const mockServer = createMockServerError('EADDRINUSE');
      mockCreateServer.mockReturnValue(mockServer);
      // CW: available
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkSinglePort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('in_use');
      expect(result.source).toBe('os');
    });

    it('OSでunknownかつClaudeWorkでavailableの場合、unknownを返す', async () => {
      // OS: unknown (EACCES)
      const mockServer = createMockServerError('EACCES');
      mockCreateServer.mockReturnValue(mockServer);
      // CW: available
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkSinglePort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('unknown');
    });

    it('OSでavailableかつClaudeWorkでavailableの場合、availableを返す', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkSinglePort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('available');
    });

    it('excludeEnvironmentIdを指定できる', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      mockDbSelectAll.mockReturnValue([
        {
          id: 'env-self',
          name: 'SelfEnv',
          type: 'DOCKER',
          config: JSON.stringify({
            portMappings: [{ hostPort: 8080, containerPort: 80 }],
          }),
        },
      ]);

      const result = await portChecker.checkSinglePort(8080, 'env-self');

      expect(result.port).toBe(8080);
      expect(result.status).toBe('available');
    });
  });

  describe('checkHostPort - server.close() exception', () => {
    it('server.close()が例外を投げても正しくresolveされる', async () => {
      const server = new EventEmitter() as EventEmitter & {
        listen: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      };
      server.listen = vi.fn((_port: number, _host: string, _callback: () => void) => {
        process.nextTick(() => {
          const err = new Error('Port error: EADDRINUSE');
          (err as NodeJS.ErrnoException).code = 'EADDRINUSE';
          server.emit('error', err);
        });
        return server;
      });
      server.close = vi.fn(() => {
        throw new Error('Not running');
      });
      mockCreateServer.mockReturnValue(server);

      const result = await portChecker.checkHostPort(8080);

      expect(result.port).toBe(8080);
      expect(result.status).toBe('in_use');
      expect(result.source).toBe('os');
    });
  });

  describe('checkPorts', () => {
    it('複数ポートを一括チェックして全ての結果を返す', async () => {
      // 3ポートすべて利用可能
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkPorts({
        ports: [8080, 9000, 9001],
      });

      expect(result).toHaveLength(3);
      const ports = result.map((r) => r.port);
      expect(ports).toContain(8080);
      expect(ports).toContain(9000);
      expect(ports).toContain(9001);
    });

    it('OSで使用中のポートはin_use (source: os) として返す', async () => {
      // ポート番号に基づいてモック動作を制御（callCountベースだと並列実行でフレーキー）
      mockCreateServer.mockImplementation(() => {
        const server = new EventEmitter() as EventEmitter & {
          listen: ReturnType<typeof vi.fn>;
          close: ReturnType<typeof vi.fn>;
        };
        server.listen = vi.fn((port: number, _host: string, callback: () => void) => {
          if (port === 8080) {
            // ポート8080はOS使用中
            process.nextTick(() => {
              const err = new Error('Port error: EADDRINUSE');
              (err as NodeJS.ErrnoException).code = 'EADDRINUSE';
              server.emit('error', err);
            });
          } else {
            // その他のポートは利用可能
            process.nextTick(() => {
              callback();
            });
          }
          return server;
        });
        server.close = vi.fn((callback?: () => void) => {
          if (callback) process.nextTick(callback);
          return server;
        });
        return server;
      });
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkPorts({
        ports: [8080, 9000],
      });

      expect(result).toHaveLength(2);
      const port8080 = result.find((r) => r.port === 8080);
      expect(port8080?.status).toBe('in_use');
      expect(port8080?.source).toBe('os');

      const port9000 = result.find((r) => r.port === 9000);
      expect(port9000?.status).toBe('available');
    });

    it('重複ポートをユニーク化して自己衝突を防ぐ', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      mockDbSelectAll.mockReturnValue([]);

      const result = await portChecker.checkPorts({
        ports: [8080, 8080, 9000],
      });

      expect(result).toHaveLength(3);
      // 重複分も含めて結果が返る
      expect(result[0].port).toBe(8080);
      expect(result[1].port).toBe(8080);
      expect(result[2].port).toBe(9000);
      // net.createServerはユニークポート分のみ呼ばれる（8080 + 9000 = 2回）
      expect(mockCreateServer).toHaveBeenCalledTimes(2);
    });

    it('ClaudeWorkチェックのDB呼び出しは1回のみ', async () => {
      const mockServer = createMockServerSuccess();
      mockCreateServer.mockReturnValue(mockServer);
      mockDbSelectAll.mockReturnValue([]);

      await portChecker.checkPorts({
        ports: [8080, 9000, 9001],
      });

      // checkClaudeWorkPortsは1回だけ呼ばれる（以前はポート数分呼ばれていた）
      expect(mockDbSelectAll).toHaveBeenCalledTimes(1);
    });
  });
});
