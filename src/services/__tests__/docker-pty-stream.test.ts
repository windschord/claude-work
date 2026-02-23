import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerPTYStream } from '../docker-pty-stream';
import { EventEmitter } from 'events';

// Mock Dockerode types
const mockContainer = {
  resize: vi.fn().mockResolvedValue(undefined),
  kill: vi.fn().mockResolvedValue(undefined),
  inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0, Running: false } }),
};

const mockExec = {
  resize: vi.fn().mockResolvedValue(undefined),
  inspect: vi.fn().mockResolvedValue({ ExitCode: 0, Running: false }),
};

const mockStream = new EventEmitter() as any;
mockStream.write = vi.fn();
mockStream.end = vi.fn();
mockStream.pause = vi.fn();
mockStream.resume = vi.fn();

describe('DockerPTYStream', () => {
  let stream: DockerPTYStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.removeAllListeners();
  });

  it('should implement IPty interface', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    expect(stream.pid).toBe(0);
    expect(stream.cols).toBe(80);
    expect(stream.rows).toBe(24);
    expect(typeof stream.on).toBe('function');
    expect(typeof stream.resize).toBe('function');
    expect(typeof stream.write).toBe('function');
    expect(typeof stream.kill).toBe('function');
  });

  it('should handle container resize', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    stream.resize(100, 30);
    expect(mockContainer.resize).toHaveBeenCalledWith({ w: 100, h: 30 });
    expect(stream.cols).toBe(100);
    expect(stream.rows).toBe(30);
  });

  it('should handle exec resize', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: false,
      exec: mockExec as any,
    });

    stream.resize(120, 40);
    expect(mockExec.resize).toHaveBeenCalledWith({ w: 120, h: 40 });
    expect(stream.cols).toBe(120);
    expect(stream.rows).toBe(40);
  });

  it('should forward data from stream', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });
    
    stream.setStream(mockStream);
    
    const dataSpy = vi.fn();
    stream.on('data', dataSpy);
    
    mockStream.emit('data', Buffer.from('test data'));
    
    expect(dataSpy).toHaveBeenCalledWith('test data');
  });

  it('should write data to stream', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });
    
    stream.setStream(mockStream);
    stream.write('input');
    
    expect(mockStream.write).toHaveBeenCalledWith('input');
  });

  it('should handle exit for container', async () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });
    
    stream.setStream(mockStream);
    
    const exitSpy = vi.fn();
    stream.on('exit', exitSpy);
    
    mockStream.emit('end');
    
    // Allow async checkExit to run
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockContainer.inspect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
  });

  it('should kill container', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });
    
    stream.kill('SIGTERM');
    expect(mockContainer.kill).toHaveBeenCalledWith({ signal: 'SIGTERM' });
  });
});
