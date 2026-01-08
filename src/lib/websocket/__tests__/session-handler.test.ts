import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

const mocks = vi.hoisted(() => {
  const mockSessionManager = {
    findById: vi.fn(),
  };

  // Create mock functions that will be attached to the PTY
  const mockPtyWrite = vi.fn();
  const mockPtyResize = vi.fn();
  const mockPtyKill = vi.fn();
  const mockPtySpawn = vi.fn();

  return {
    mockSessionManager,
    mockPtyWrite,
    mockPtyResize,
    mockPtyKill,
    mockPtySpawn,
  };
});

// Create mock PTY outside hoisted (EventEmitter needs to be imported first)
let mockPty: EventEmitter & {
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (info: { exitCode: number; signal?: number }) => void) => void;
  pid: number;
};

function createMockPty() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    write: mocks.mockPtyWrite,
    resize: mocks.mockPtyResize,
    kill: mocks.mockPtyKill,
    onData: (callback: (data: string) => void) => emitter.on('data', callback),
    onExit: (callback: (info: { exitCode: number; signal?: number }) => void) => emitter.on('exit', callback),
    pid: 12345,
  });
}

vi.mock('@/services/session-manager', () => ({
  SessionManager: class MockSessionManager {
    findById = mocks.mockSessionManager.findById;
  },
}));

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => {
    mocks.mockPtySpawn(...args);
    return mockPty;
  },
}));

import { setupSessionWebSocket } from '../session-handler';

describe('Session WebSocket Handler', () => {
  let wss: WebSocketServer;
  let mockWs: WebSocket;
  let mockReq: { url: string; headers: { host: string } };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a fresh mock PTY for each test
    mockPty = createMockPty();

    // Create mock WebSocket
    mockWs = new EventEmitter() as WebSocket;
    mockWs.readyState = WebSocket.OPEN;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();

    // Create mock WebSocketServer
    wss = new EventEmitter() as WebSocketServer;

    // Mock request
    mockReq = {
      url: '/ws/session/session-123',
      headers: { host: 'localhost:3000' },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should establish connection and create PTY for valid session', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');

    // Trigger connection event
    wss.emit('connection', mockWs, mockReq);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should have called findById with the session ID
    expect(mocks.mockSessionManager.findById).toHaveBeenCalledWith('session-123');

    // Should have spawned docker exec
    expect(mocks.mockPtySpawn).toHaveBeenCalledWith(
      'docker',
      ['exec', '-it', 'container-abc123', '/bin/bash'],
      expect.objectContaining({
        name: 'xterm-color',
        cols: 80,
        rows: 24,
      })
    );
  });

  it('should close connection when session not found', async () => {
    mocks.mockSessionManager.findById.mockResolvedValue(null);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Session not found');
  });

  it('should close connection when container is not running', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: null,
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'creating',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockWs.close).toHaveBeenCalledWith(1008, 'Container is not running');
  });

  it('should forward input to PTY', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate input message
    const inputMessage = JSON.stringify({ type: 'input', data: 'ls -la\r' });
    mockWs.emit('message', Buffer.from(inputMessage));

    expect(mocks.mockPtyWrite).toHaveBeenCalledWith('ls -la\r');
  });

  it('should handle resize events', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate resize message
    const resizeMessage = JSON.stringify({ type: 'resize', data: { cols: 120, rows: 40 } });
    mockWs.emit('message', Buffer.from(resizeMessage));

    expect(mocks.mockPtyResize).toHaveBeenCalledWith(120, 40);
  });

  it('should forward PTY output to WebSocket', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate PTY output
    mockPty.emit('data', 'total 8\ndrwxr-xr-x 2 root root 4096 Jan  6 00:00 .\n');

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'data',
      content: 'total 8\ndrwxr-xr-x 2 root root 4096 Jan  6 00:00 .\n',
    }));
  });

  it('should clean up PTY on WebSocket close', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate WebSocket close
    mockWs.emit('close');

    expect(mocks.mockPtyKill).toHaveBeenCalled();
  });

  it('should send exit message when PTY exits', async () => {
    const mockSession = {
      id: 'session-123',
      name: 'test-session',
      containerId: 'container-abc123',
      volumeName: 'claudework-test-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    setupSessionWebSocket(wss, '/ws/session');
    wss.emit('connection', mockWs, mockReq);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate PTY exit
    mockPty.emit('exit', { exitCode: 0, signal: null });

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'exit',
      exitCode: 0,
      signal: null,
    }));
    expect(mockWs.close).toHaveBeenCalled();
  });
});
