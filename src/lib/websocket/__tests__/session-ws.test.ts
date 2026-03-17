import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// DBモック
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    sessions: {
      id: 'id',
    },
  },
}));

// drizzle-ormモック
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

// RunScriptManagerモック
const mockRunScriptManager = new EventEmitter();
vi.mock('../../../services/run-script-manager', () => ({
  getRunScriptManager: () => mockRunScriptManager,
}));

// ProcessLifecycleManagerモック
const mockLifecycleManager = new EventEmitter();
mockLifecycleManager.updateActivity = vi.fn();
vi.mock('../../../services/process-lifecycle-manager', () => ({
  getProcessLifecycleManager: () => mockLifecycleManager,
}));

import { SessionWebSocketHandler } from '../session-ws';

import { db } from '@/lib/db';

// Mock WebSocket
function createMockWs(): any {
  const ws = new EventEmitter() as any;
  ws.send = vi.fn();
  ws.close = vi.fn();
  ws.readyState = 1; // OPEN
  return ws;
}

// Mock ConnectionManager
function createMockConnectionManager(): any {
  return {
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    getConnectionCount: vi.fn().mockReturnValue(0),
    broadcast: vi.fn(),
    broadcastAll: vi.fn(),
    getConnections: vi.fn().mockReturnValue([]),
    cleanup: vi.fn(),
  };
}

describe('SessionWebSocketHandler', () => {
  let handler: SessionWebSocketHandler;
  let mockConnectionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionManager = createMockConnectionManager();
    handler = new SessionWebSocketHandler(mockConnectionManager);
  });

  afterEach(() => {
    mockRunScriptManager.removeAllListeners();
    (mockLifecycleManager as EventEmitter).removeAllListeners();
  });

  describe('constructor', () => {
    it('should export SessionWebSocketHandler class', () => {
      expect(SessionWebSocketHandler).toBeDefined();
      expect(typeof SessionWebSocketHandler).toBe('function');
    });

    it('should accept ConnectionManager', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('RunScriptManager event forwarding', () => {
    it('should forward output events as run_script_log', () => {
      // Re-create handler to attach listeners
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      mockRunScriptManager.emit('output', {
        runId: 'run-1',
        sessionId: 'session-1',
        type: 'stdout',
        content: 'test output',
      });

      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'run_script_log',
          runId: 'run-1',
          level: 'info',
          content: 'test output',
        })
      );
    });

    it('should forward error events as run_script_log with error level', () => {
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      mockRunScriptManager.emit('error', {
        runId: 'run-1',
        sessionId: 'session-1',
        content: 'error output',
      });

      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'run_script_log',
          runId: 'run-1',
          level: 'error',
          content: 'error output',
        })
      );
    });

    it('should forward exit events as run_script_exit', () => {
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      mockRunScriptManager.emit('exit', {
        runId: 'run-1',
        sessionId: 'session-1',
        exitCode: 0,
        signal: null,
        executionTime: 1000,
      });

      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'run_script_exit',
          runId: 'run-1',
          exitCode: 0,
          signal: null,
          executionTime: 1000,
        })
      );
    });
  });

  describe('ProcessLifecycleManager event forwarding', () => {
    it('should forward processPaused events', () => {
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      (mockLifecycleManager as EventEmitter).emit('processPaused', 'session-1', 'idle_timeout');

      // Should broadcast both process_paused and status_change
      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'process_paused',
          reason: 'idle_timeout',
        })
      );
      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'status_change',
          status: 'stopped',
        })
      );
    });

    it('should forward processResumed events', () => {
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      (mockLifecycleManager as EventEmitter).emit('processResumed', 'session-1', true);

      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'process_resumed',
          resumedWithHistory: true,
        })
      );
      expect(cm.broadcast).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'status_change',
          status: 'running',
        })
      );
    });

    it('should forward serverShutdown events to all clients', () => {
      const cm = createMockConnectionManager();
      const _h = new SessionWebSocketHandler(cm);

      (mockLifecycleManager as EventEmitter).emit('serverShutdown', 'SIGTERM');

      expect(cm.broadcastAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'server_shutdown',
          signal: 'SIGTERM',
        })
      );
    });
  });

  describe('handleConnection', () => {
    it('should add connection to manager', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(mockConnectionManager.addConnection).toHaveBeenCalledWith('session-1', ws);
    });

    it('should update activity on lifecycle manager', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(mockLifecycleManager.updateActivity).toHaveBeenCalledWith('session-1');
    });

    it('should register message handler', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(ws.listenerCount('message')).toBeGreaterThan(0);
    });

    it('should register close handler', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(ws.listenerCount('close')).toBeGreaterThan(0);
    });

    it('should register error handler', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(ws.listenerCount('error')).toBeGreaterThan(0);
    });

    it('should send status_change message with session status', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'status_change',
          status: 'running',
        })
      );
    });

    it('should send error status when DB query fails', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockRejectedValue(new Error('DB error'));

      await handler.handleConnection(ws, 'session-1');

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'status_change',
          status: 'error',
        })
      );
    });

    it('should send error status when session not found', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue(undefined);

      await handler.handleConnection(ws, 'session-1');

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'status_change',
          status: 'error',
        })
      );
    });

    it('should remove connection on close', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');
      ws.emit('close');

      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('session-1', ws);
    });

    it('should remove connection on error', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');
      ws.emit('error', new Error('test error'));

      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('session-1', ws);
    });
  });

  describe('handleMessage', () => {
    it('should respond with error for any message type', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      // Send a message
      const message = Buffer.from(JSON.stringify({ type: 'input', data: 'test' }));
      ws.emit('message', message);

      // Should respond with error directing to Claude WS
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('Use /ws/claude/:sessionId')
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');

      const message = Buffer.from('not json');
      ws.emit('message', message);

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format')
      );
    });

    it('should update activity on message', async () => {
      const ws = createMockWs();
      vi.mocked(db.query.sessions.findFirst).mockResolvedValue({
        status: 'running',
      } as any);

      await handler.handleConnection(ws, 'session-1');
      vi.clearAllMocks();

      const message = Buffer.from(JSON.stringify({ type: 'test' }));
      ws.emit('message', message);

      expect(mockLifecycleManager.updateActivity).toHaveBeenCalledWith('session-1');
    });
  });
});
