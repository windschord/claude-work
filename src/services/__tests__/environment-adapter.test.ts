import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import {
  EnvironmentAdapter,
  CreateSessionOptions,
  PTYExitInfo,
  isEnvironmentAdapter,
} from '../environment-adapter';

describe('EnvironmentAdapter', () => {
  describe('CreateSessionOptions interface', () => {
    it('should accept resumeSessionId as optional property', () => {
      const options: CreateSessionOptions = {};
      expect(options.resumeSessionId).toBeUndefined();

      const optionsWithResume: CreateSessionOptions = {
        resumeSessionId: 'test-session-id',
      };
      expect(optionsWithResume.resumeSessionId).toBe('test-session-id');
    });
  });

  describe('PTYExitInfo interface', () => {
    it('should have exitCode as required property', () => {
      const exitInfo: PTYExitInfo = {
        exitCode: 0,
      };
      expect(exitInfo.exitCode).toBe(0);
    });

    it('should accept signal as optional property', () => {
      const exitInfo: PTYExitInfo = {
        exitCode: 1,
        signal: 15,
      };
      expect(exitInfo.exitCode).toBe(1);
      expect(exitInfo.signal).toBe(15);
    });
  });

  describe('isEnvironmentAdapter type guard', () => {
    it('should return false for null', () => {
      expect(isEnvironmentAdapter(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEnvironmentAdapter(undefined)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isEnvironmentAdapter('string')).toBe(false);
      expect(isEnvironmentAdapter(123)).toBe(false);
      expect(isEnvironmentAdapter(true)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isEnvironmentAdapter({})).toBe(false);
    });

    it('should return false for object missing some methods', () => {
      const partialAdapter = {
        createSession: () => {},
        write: () => {},
        resize: () => {},
        // missing destroySession, restartSession, hasSession, getWorkingDir
      };
      expect(isEnvironmentAdapter(partialAdapter)).toBe(false);
    });

    it('should return false for object without EventEmitter methods', () => {
      const adapterWithoutEmitter = {
        createSession: () => {},
        write: () => {},
        resize: () => {},
        destroySession: () => {},
        restartSession: () => {},
        hasSession: () => true,
        getWorkingDir: () => '/test',
        // missing on and emit
      };
      expect(isEnvironmentAdapter(adapterWithoutEmitter)).toBe(false);
    });

    it('should return true for valid adapter implementation', () => {
      // Create a mock implementation that satisfies the interface
      class MockAdapter extends EventEmitter implements EnvironmentAdapter {
        createSession(
          _sessionId: string,
          _workingDir: string,
          _initialPrompt?: string,
          _options?: CreateSessionOptions
        ): void {}

        write(_sessionId: string, _data: string): void {}

        resize(_sessionId: string, _cols: number, _rows: number): void {}

        destroySession(_sessionId: string): void {}

        restartSession(_sessionId: string): void {}

        hasSession(_sessionId: string): boolean {
          return false;
        }

        getWorkingDir(_sessionId: string): string | undefined {
          return undefined;
        }
      }

      const mockAdapter = new MockAdapter();
      expect(isEnvironmentAdapter(mockAdapter)).toBe(true);
    });
  });

  describe('EnvironmentAdapter interface compliance', () => {
    it('should allow creating an implementation that extends EventEmitter', () => {
      class TestAdapter extends EventEmitter implements EnvironmentAdapter {
        private sessions = new Map<string, string>();

        createSession(
          sessionId: string,
          workingDir: string,
          _initialPrompt?: string,
          _options?: CreateSessionOptions
        ): void {
          this.sessions.set(sessionId, workingDir);
          this.emit('created', sessionId);
        }

        write(sessionId: string, data: string): void {
          this.emit('data', sessionId, data);
        }

        resize(sessionId: string, cols: number, rows: number): void {
          this.emit('resize', sessionId, { cols, rows });
        }

        destroySession(sessionId: string): void {
          this.sessions.delete(sessionId);
          this.emit('destroyed', sessionId);
        }

        restartSession(sessionId: string): void {
          const workingDir = this.sessions.get(sessionId);
          if (workingDir) {
            this.destroySession(sessionId);
            this.createSession(sessionId, workingDir);
          }
        }

        hasSession(sessionId: string): boolean {
          return this.sessions.has(sessionId);
        }

        getWorkingDir(sessionId: string): string | undefined {
          return this.sessions.get(sessionId);
        }
      }

      const adapter = new TestAdapter();

      // Verify EventEmitter functionality
      let dataReceived = false;
      adapter.on('data', (sessionId: string, data: string) => {
        expect(sessionId).toBe('test-session');
        expect(data).toBe('test-data');
        dataReceived = true;
      });

      adapter.createSession('test-session', '/test/path');
      expect(adapter.hasSession('test-session')).toBe(true);
      expect(adapter.getWorkingDir('test-session')).toBe('/test/path');

      adapter.write('test-session', 'test-data');
      expect(dataReceived).toBe(true);

      adapter.destroySession('test-session');
      expect(adapter.hasSession('test-session')).toBe(false);
    });

    it('should emit proper events for session lifecycle', () => {
      class TestAdapter extends EventEmitter implements EnvironmentAdapter {
        private sessions = new Map<string, string>();

        createSession(
          sessionId: string,
          workingDir: string,
          _initialPrompt?: string,
          _options?: CreateSessionOptions
        ): void {
          this.sessions.set(sessionId, workingDir);
        }

        write(_sessionId: string, _data: string): void {}

        resize(_sessionId: string, _cols: number, _rows: number): void {}

        destroySession(sessionId: string): void {
          this.sessions.delete(sessionId);
          const exitInfo: PTYExitInfo = { exitCode: 0 };
          this.emit('exit', sessionId, exitInfo);
        }

        restartSession(_sessionId: string): void {}

        hasSession(sessionId: string): boolean {
          return this.sessions.has(sessionId);
        }

        getWorkingDir(sessionId: string): string | undefined {
          return this.sessions.get(sessionId);
        }
      }

      const adapter = new TestAdapter();
      const events: Array<{ event: string; args: unknown[] }> = [];

      adapter.on('exit', (sessionId: string, info: PTYExitInfo) => {
        events.push({ event: 'exit', args: [sessionId, info] });
      });

      adapter.createSession('session-1', '/path/to/session');
      adapter.destroySession('session-1');

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('exit');
      expect(events[0].args[0]).toBe('session-1');
      expect((events[0].args[1] as PTYExitInfo).exitCode).toBe(0);
    });

    it('should support error event emission', () => {
      class TestAdapter extends EventEmitter implements EnvironmentAdapter {
        createSession(
          _sessionId: string,
          _workingDir: string,
          _initialPrompt?: string,
          _options?: CreateSessionOptions
        ): void {
          throw new Error('Test error');
        }

        write(_sessionId: string, _data: string): void {}
        resize(_sessionId: string, _cols: number, _rows: number): void {}
        destroySession(_sessionId: string): void {}
        restartSession(_sessionId: string): void {}
        hasSession(_sessionId: string): boolean {
          return false;
        }
        getWorkingDir(_sessionId: string): string | undefined {
          return undefined;
        }
      }

      const adapter = new TestAdapter();
      let errorReceived: Error | null = null;

      adapter.on('error', (sessionId: string, error: Error) => {
        expect(sessionId).toBe('session-1');
        errorReceived = error;
      });

      try {
        adapter.createSession('session-1', '/test');
      } catch (e) {
        adapter.emit('error', 'session-1', e as Error);
      }

      expect(errorReceived).not.toBeNull();
      expect((errorReceived as Error).message).toBe('Test error');
    });

    it('should support claudeSessionId event emission', () => {
      class TestAdapter extends EventEmitter implements EnvironmentAdapter {
        createSession(
          sessionId: string,
          _workingDir: string,
          _initialPrompt?: string,
          _options?: CreateSessionOptions
        ): void {
          // Simulate extracting Claude session ID
          setTimeout(() => {
            this.emit('claudeSessionId', sessionId, 'claude-abc123');
          }, 0);
        }

        write(_sessionId: string, _data: string): void {}
        resize(_sessionId: string, _cols: number, _rows: number): void {}
        destroySession(_sessionId: string): void {}
        restartSession(_sessionId: string): void {}
        hasSession(_sessionId: string): boolean {
          return true;
        }
        getWorkingDir(_sessionId: string): string | undefined {
          return '/test';
        }
      }

      return new Promise<void>((resolve) => {
        const adapter = new TestAdapter();

        adapter.on('claudeSessionId', (sessionId: string, claudeSessionId: string) => {
          expect(sessionId).toBe('session-1');
          expect(claudeSessionId).toBe('claude-abc123');
          resolve();
        });

        adapter.createSession('session-1', '/test');
      });
    });
  });
});
