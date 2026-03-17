import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerPTYStream } from '../docker-pty-stream';
import { EventEmitter } from 'events';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

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

function createMockStream() {
  const s = new EventEmitter() as any;
  s.write = vi.fn();
  s.end = vi.fn();
  s.pause = vi.fn();
  s.resume = vi.fn();
  s.destroy = vi.fn();
  return s;
}

let mockStream: any;

describe('DockerPTYStream', () => {
  let stream: DockerPTYStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = createMockStream();
    mockContainer.resize.mockResolvedValue(undefined);
    mockContainer.kill.mockResolvedValue(undefined);
    mockContainer.inspect.mockResolvedValue({ State: { ExitCode: 0, Running: false } });
    mockExec.resize.mockResolvedValue(undefined);
    mockExec.inspect.mockResolvedValue({ ExitCode: 0, Running: false });
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

    await vi.waitFor(() => {
      expect(mockContainer.inspect).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
    });
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

  it('should warn when write() is called before setStream()', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    // write() before setStream() should not throw
    expect(() => stream.write('test')).not.toThrow();
    // mockStream.write should not be called since stream is not set
    expect(mockStream.write).not.toHaveBeenCalled();
  });

  it('should emit exit event on stream error', async () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    stream.setStream(mockStream);

    const exitSpy = vi.fn();
    stream.on('exit', exitSpy);

    mockStream.emit('error', new Error('connection lost'));

    expect(exitSpy).toHaveBeenCalledWith({ exitCode: 1, signal: 0 });
  });

  it('should remove stream listeners on kill()', () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    stream.setStream(mockStream);

    const removeAllListenersSpy = vi.spyOn(mockStream, 'removeAllListeners');
    stream.kill();

    expect(removeAllListenersSpy).toHaveBeenCalled();
    removeAllListenersSpy.mockRestore();
  });

  it('should handle close event same as end event', async () => {
    stream = new DockerPTYStream({
      cols: 80,
      rows: 24,
      isContainer: true,
      container: mockContainer as any,
    });

    stream.setStream(mockStream);

    const exitSpy = vi.fn();
    stream.on('exit', exitSpy);

    mockStream.emit('close');

    await vi.waitFor(() => {
      expect(mockContainer.inspect).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
    });
  });

  describe('constructor validation', () => {
    it('should throw when isContainer is true but no container provided', () => {
      expect(() => new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
      })).toThrow('Container instance is required for container PTY stream');
    });

    it('should throw when isContainer is false but no exec provided', () => {
      expect(() => new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
      })).toThrow('Exec instance is required for exec PTY stream');
    });

    it('should set process property to docker', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });
      expect(stream.process).toBe('docker');
    });

    it('should set handleFlowControl to false', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });
      expect(stream.handleFlowControl).toBe(false);
    });
  });

  describe('exec mode', () => {
    it('should handle exit for exec', async () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.setStream(mockStream);

      const exitSpy = vi.fn();
      stream.on('exit', exitSpy);

      mockStream.emit('end');

      await vi.waitFor(() => {
        expect(mockExec.inspect).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
      });
    });

    it('should handle exec exit code from inspect', async () => {
      mockExec.inspect.mockResolvedValue({ ExitCode: 42, Running: false });

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.setStream(mockStream);

      const exitSpy = vi.fn();
      stream.on('exit', exitSpy);

      mockStream.emit('end');

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 42, signal: 0 });
      });
    });

    it('should handle null exec exit code as 0', async () => {
      mockExec.inspect.mockResolvedValue({ ExitCode: null, Running: false });

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.setStream(mockStream);

      const exitSpy = vi.fn();
      stream.on('exit', exitSpy);

      mockStream.emit('end');

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
      });
    });
  });

  describe('container exit code', () => {
    it('should handle non-zero container exit code', async () => {
      mockContainer.inspect.mockResolvedValue({ State: { ExitCode: 137, Running: false } });

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

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 137, signal: 0 });
      });
    });

    it('should handle null container exit code as 0', async () => {
      mockContainer.inspect.mockResolvedValue({ State: { ExitCode: null, Running: false } });

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

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });
      });
    });
  });

  describe('checkExit error handling', () => {
    it('should emit exit with code 1 on inspect error', async () => {
      mockContainer.inspect.mockRejectedValue(new Error('inspect failed'));

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

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith({ exitCode: 1, signal: 0 });
      });
    });
  });

  describe('duplicate exit guard', () => {
    it('should only emit exit once for end+close', async () => {
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
      mockStream.emit('close');

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should only emit exit once for error+end', async () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);

      const exitSpy = vi.fn();
      stream.on('exit', exitSpy);

      mockStream.emit('error', new Error('test'));
      mockStream.emit('end');

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('setStream replacement', () => {
    it('should replace existing stream and remove old listeners', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      const oldStream = createMockStream();
      const newStream = createMockStream();

      stream.setStream(oldStream);

      const dataSpy = vi.fn();
      stream.on('data', dataSpy);

      stream.setStream(newStream);

      // Old stream events should not reach the PTY stream
      oldStream.emit('data', 'old data');
      expect(dataSpy).not.toHaveBeenCalled();

      // New stream events should work
      newStream.emit('data', 'new data');
      expect(dataSpy).toHaveBeenCalledWith('new data');
    });
  });

  describe('onData disposable', () => {
    it('should register data listener and return disposable', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);

      const dataSpy = vi.fn();
      const disposable = stream.onData(dataSpy);

      mockStream.emit('data', 'test');
      expect(dataSpy).toHaveBeenCalledWith('test');

      disposable.dispose();

      mockStream.emit('data', 'after dispose');
      expect(dataSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onExit disposable', () => {
    it('should register exit listener and return disposable', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      const exitSpy = vi.fn();
      const disposable = stream.onExit(exitSpy);

      stream.emit('exit', { exitCode: 0, signal: 0 });
      expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: 0 });

      disposable.dispose();

      stream.emit('exit', { exitCode: 1, signal: 0 });
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause and resume', () => {
    it('should pause the underlying stream', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      stream.pause();
      expect(mockStream.pause).toHaveBeenCalled();
    });

    it('should resume the underlying stream', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      stream.resume();
      expect(mockStream.resume).toHaveBeenCalled();
    });

    it('should not throw if pause called without stream', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      expect(() => stream.pause()).not.toThrow();
    });

    it('should not throw if resume called without stream', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      expect(() => stream.resume()).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should be a no-op that does not throw', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      expect(() => stream.clear()).not.toThrow();
    });
  });

  describe('kill', () => {
    it('should use SIGKILL as default signal', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.kill();
      expect(mockContainer.kill).toHaveBeenCalledWith({ signal: 'SIGKILL' });
    });

    it('should destroy stream if destroy function exists', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      stream.kill();
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    it('should end the stream on kill', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      stream.kill();
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should not kill container for exec mode', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.setStream(mockStream);
      stream.kill();
      expect(mockContainer.kill).not.toHaveBeenCalled();
      // But stream should still be cleaned up
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle kill when no stream is set', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      // Should not throw
      expect(() => stream.kill()).not.toThrow();
    });

    it('should handle container kill rejection gracefully', async () => {
      mockContainer.kill.mockRejectedValue(new Error('already stopped'));

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      // Should not throw
      stream.kill();
      // Wait for the rejected promise to be caught
      await vi.waitFor(() => {
        expect(mockContainer.kill).toHaveBeenCalled();
      });
    });
  });

  describe('resize error handling', () => {
    it('should handle container resize rejection gracefully', async () => {
      mockContainer.resize.mockRejectedValue(new Error('resize failed'));

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.resize(100, 30);
      // cols and rows should still be updated
      await vi.waitFor(() => {
        expect(stream.cols).toBe(100);
        expect(stream.rows).toBe(30);
      });
    });

    it('should handle exec resize rejection gracefully', async () => {
      mockExec.resize.mockRejectedValue(new Error('resize failed'));

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.resize(100, 30);
      await vi.waitFor(() => {
        expect(mockExec.resize).toHaveBeenCalled();
      });
    });

    it('should handle synchronous error during resize', () => {
      const badContainer = {
        resize: vi.fn(() => { throw new Error('sync error'); }),
        kill: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0 } }),
      };

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: badContainer as any,
      });

      // Should not throw
      expect(() => stream.resize(100, 30)).not.toThrow();
    });
  });

  describe('logger verification', () => {
    it('should log when stream ends', async () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      mockStream.emit('end');

      expect(mockLogger.info).toHaveBeenCalledWith('DockerPTYStream: Stream ended');
    });

    it('should log error on stream error', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      const err = new Error('test error');
      mockStream.emit('error', err);

      expect(mockLogger.error).toHaveBeenCalledWith('DockerPTYStream: Stream error', { error: err });
    });

    it('should log error on inspect failure', async () => {
      const inspectError = new Error('inspect failed');
      mockContainer.inspect.mockRejectedValue(inspectError);

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);
      mockStream.emit('end');

      await vi.waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith('DockerPTYStream: Failed to check exit code', { error: inspectError });
      });
    });

    it('should log warn on resize failure', async () => {
      const resizeError = new Error('resize failed');
      mockContainer.resize.mockRejectedValue(resizeError);

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.resize(100, 30);

      await vi.waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith('DockerPTYStream: Failed to resize container', { error: resizeError });
      });
    });

    it('should log warn on exec resize failure', async () => {
      const resizeError = new Error('exec resize failed');
      mockExec.resize.mockRejectedValue(resizeError);

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: false,
        exec: mockExec as any,
      });

      stream.resize(100, 30);

      await vi.waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith('DockerPTYStream: Failed to resize exec', { error: resizeError });
      });
    });

    it('should log warn on synchronous resize error', () => {
      const syncError = new Error('sync error');
      const badContainer = {
        resize: vi.fn(() => { throw syncError; }),
        kill: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0 } }),
      };

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: badContainer as any,
      });

      stream.resize(100, 30);
      expect(mockLogger.warn).toHaveBeenCalledWith('DockerPTYStream: Synchronous error calling resize', { error: syncError });
    });

    it('should log info on kill', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.kill('SIGTERM');
      expect(mockLogger.info).toHaveBeenCalledWith('DockerPTYStream: kill called', { signal: 'SIGTERM' });
    });

    it('should log debug on clear', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.clear();
      expect(mockLogger.debug).toHaveBeenCalledWith('DockerPTYStream: clear called (no-op)');
    });

    it('should log warn when write called without stream', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.write('test');
      expect(mockLogger.warn).toHaveBeenCalledWith('DockerPTYStream: write called but stream is not set');
    });

    it('should log debug on container kill rejection', async () => {
      mockContainer.kill.mockRejectedValue(new Error('already stopped'));

      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.kill();

      await vi.waitFor(() => {
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DockerPTYStream: Failed to kill container (may be already stopped)',
          { error: expect.any(Error) }
        );
      });
    });
  });

  describe('stream error with duplicate guard', () => {
    it('should ignore stream error after exit already handled', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);

      const exitSpy = vi.fn();
      stream.on('exit', exitSpy);

      // First: error triggers exit
      mockStream.emit('error', new Error('first'));
      expect(exitSpy).toHaveBeenCalledTimes(1);

      // Second: error should be ignored
      mockStream.emit('error', new Error('second'));
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('data forwarding', () => {
    it('should convert Buffer data to string', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);

      const dataSpy = vi.fn();
      stream.on('data', dataSpy);

      mockStream.emit('data', Buffer.from('hello'));
      expect(dataSpy).toHaveBeenCalledWith('hello');
    });

    it('should handle string data', () => {
      stream = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: mockContainer as any,
      });

      stream.setStream(mockStream);

      const dataSpy = vi.fn();
      stream.on('data', dataSpy);

      mockStream.emit('data', 'string data');
      expect(dataSpy).toHaveBeenCalledWith('string data');
    });
  });
});
