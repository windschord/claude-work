import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted()でモック定義
const {
  mockClaudePtyManager,
  mockDb,
  mockEnvironmentService,
  mockAdapterFactory,
  createMockAdapter,
} = vi.hoisted(() => {
  const createMockAdapterFn = () => ({
    createSession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    destroySession: vi.fn(),
    restartSession: vi.fn(),
    hasSession: vi.fn().mockReturnValue(true),
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
      hasSession: vi.fn().mockReturnValue(true),
      getScrollbackBuffer: vi.fn().mockReturnValue(null),
      on: vi.fn(),
      off: vi.fn(),
    },
    mockDb: {
      query: {
        sessions: { findFirst: vi.fn() },
        messages: { findFirst: vi.fn() },
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

vi.mock('@/services/claude-pty-manager', () => ({ claudePtyManager: mockClaudePtyManager }));
vi.mock('@/lib/db', () => ({ db: mockDb, schema: { sessions: {}, messages: {} } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/services/environment-service', () => ({ environmentService: mockEnvironmentService }));
vi.mock('@/services/adapter-factory', () => ({ AdapterFactory: mockAdapterFactory }));
vi.mock('@/services/scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    getBuffer: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    has: vi.fn().mockReturnValue(false),
  },
}));

// fsモック
const mockFs = vi.hoisted(() => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('fs/promises', () => ({
  default: mockFs.promises,
  mkdir: mockFs.promises.mkdir,
  writeFile: mockFs.promises.writeFile,
}));

import { setupClaudeWebSocket } from '../claude-ws';
import { WebSocketServer, WebSocket } from 'ws';

describe('Claude WebSocket - Image Paste', () => {
  let mockWss: WebSocketServer;
  let mockWs: WebSocket;
  let connectionHandler: (ws: WebSocket, req: any) => Promise<void>;
  let messageHandler: (message: Buffer) => void;

  const worktreePath = '/tmp/test-worktree';
  const sessionId = 'session-image-test';

  beforeEach(() => {
    vi.clearAllMocks();

    mockWss = {
      on: vi.fn((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      }),
    } as unknown as WebSocketServer;

    mockWs = {
      readyState: WebSocket.OPEN,
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      off: vi.fn(),
    } as unknown as WebSocket;

    mockDb.query.sessions.findFirst.mockResolvedValue({
      id: sessionId,
      worktree_path: worktreePath,
      docker_mode: false,
      environment_id: 'env-test',
    });
    mockDb.query.messages.findFirst.mockResolvedValue(null);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    });

    mockEnvironmentService.findById.mockResolvedValue({
      id: 'env-test',
      name: 'Test',
      type: 'HOST',
      config: '{}',
      auth_dir_path: null,
      is_default: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const mockAdapter = createMockAdapter();
    mockAdapterFactory.getAdapter.mockReturnValue(mockAdapter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  async function connectAndGetAdapter() {
    setupClaudeWebSocket(mockWss, '/ws/claude');
    await connectionHandler(mockWs, {
      url: `/ws/claude/${sessionId}`,
      headers: { host: 'localhost:3000' },
    });
    return mockAdapterFactory.getAdapter.mock.results[0]?.value;
  }

  it('正常なPNG画像が保存される', async () => {
    const adapter = await connectAndGetAdapter();

    const imageData = Buffer.from('fake-png-data').toString('base64');
    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: imageData,
      mimeType: 'image/png',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
    });

    const writeCall = mockFs.promises.writeFile.mock.calls[0];
    expect(writeCall[0]).toContain('.claude-images');
    expect(writeCall[0]).toMatch(/clipboard-\d+-[a-z0-9]+\.png$/);

    expect(adapter.write).toHaveBeenCalledWith(sessionId, expect.stringContaining('.claude-images'));

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"image-saved"')
    );
  });

  it('不正なMIMEタイプが拒否される', async () => {
    await connectAndGetAdapter();

    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: Buffer.from('not-an-image').toString('base64'),
      mimeType: 'text/html',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"image-error"')
      );
    });

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported image type')
    );
  });

  it('10MBを超えるデータが拒否される', async () => {
    await connectAndGetAdapter();

    const largeData = Buffer.alloc(11 * 1024 * 1024, 'a').toString('base64');
    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: largeData,
      mimeType: 'image/png',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"image-error"')
      );
    });

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Image too large')
    );
  });

  it('JPEG画像が.jpg拡張子で保存される', async () => {
    await connectAndGetAdapter();

    const imageData = Buffer.from('fake-jpeg-data').toString('base64');
    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: imageData,
      mimeType: 'image/jpeg',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
    });

    const writeCall = mockFs.promises.writeFile.mock.calls[0];
    expect(writeCall[0]).toMatch(/\.jpg$/);
  });

  it('.claude-imagesディレクトリが自動作成される', async () => {
    await connectAndGetAdapter();

    const imageData = Buffer.from('fake-data').toString('base64');
    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: imageData,
      mimeType: 'image/png',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude-images'),
        { recursive: true }
      );
    });
  });

  it('保存後にファイルパスがPTY入力として送信される', async () => {
    const adapter = await connectAndGetAdapter();

    const imageData = Buffer.from('test-image-data').toString('base64');
    const pasteMsg = JSON.stringify({
      type: 'paste-image',
      data: imageData,
      mimeType: 'image/webp',
    });

    messageHandler(Buffer.from(pasteMsg));

    await vi.waitFor(() => {
      expect(adapter.write).toHaveBeenCalled();
    });

    const writtenPath = mockFs.promises.writeFile.mock.calls[0][0];
    expect(adapter.write).toHaveBeenCalledWith(sessionId, writtenPath);
  });
});
