import { EventEmitter } from 'events';
import type { IPty, IDisposable } from 'node-pty';
import Docker from 'dockerode';
import { logger } from '@/lib/logger';

export interface DockerPTYStreamOptions {
  cols: number;
  rows: number;
  // If true, this stream is for a container attach (main process)
  // If false, it's for an exec instance
  isContainer: boolean;
  container?: Docker.Container;
  exec?: Docker.Exec;
}

/**
 * DockerPTYStream
 * 
 * Adapts Dockerode streams to the node-pty IPty interface.
 * Handles resizing and forwarding data.
 */
export class DockerPTYStream extends EventEmitter implements IPty {
  public pid: number = 0;
  public cols: number;
  public rows: number;
  public process: string = 'docker';
  public handleFlowControl: boolean = false;

  private _stream: NodeJS.ReadWriteStream | null = null;
  private _isContainer: boolean;
  private _container?: Docker.Container;
  private _exec?: Docker.Exec;
  private _disposables: (() => void)[] = [];

  constructor(options: DockerPTYStreamOptions) {
    super();
    this.cols = options.cols;
    this.rows = options.rows;
    this._isContainer = options.isContainer;
    this._container = options.container;
    this._exec = options.exec;

    if (this._isContainer && !this._container) {
      throw new Error('Container instance is required for container PTY stream');
    }
    if (!this._isContainer && !this._exec) {
      throw new Error('Exec instance is required for exec PTY stream');
    }
  }

  /**
   * Sets the underlying stream from Dockerode
   */
  public setStream(stream: NodeJS.ReadWriteStream): void {
    this._stream = stream;
    
    // Handle data
    const dataListener = (data: Buffer | string) => {
      this.emit('data', data.toString());
    };
    stream.on('data', dataListener);
    
    // Handle end/close
    const endListener = () => {
      logger.info('DockerPTYStream: Stream ended');
      this.checkExit();
    };
    stream.on('end', endListener);
    // stream.on('close', endListener); // 'close' might be emitted too

    // Error handling
    stream.on('error', (err) => {
      logger.error('DockerPTYStream: Stream error', { error: err });
      // Emit exit with error code if possible, or just log
    });
  }

  /**
   * Checks for exit code and emits 'exit' event
   */
  private async checkExit(): Promise<void> {
    try {
      if (this._isContainer && this._container) {
        // For container, inspect to get exit code
        const data = await this._container.inspect();
        const exitCode = data.State.ExitCode;
        // const signal = 0; // Docker doesn't easily give signal in inspect?
        // Check if it was killed by signal?
        // State.Error might contain error message
        
        this.emit('exit', { exitCode, signal: 0 });
      } else if (!this._isContainer && this._exec) {
        // For exec, inspect exec instance
        const data = await this._exec.inspect();
        const exitCode = data.ExitCode;
        this.emit('exit', { exitCode: exitCode ?? 0, signal: 0 });
      }
    } catch (error) {
      logger.error('DockerPTYStream: Failed to check exit code', { error });
      // Fallback exit code
      this.emit('exit', { exitCode: 1, signal: 0 });
    }
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    
    const resizeOpts = { w: cols, h: rows };
    
    try {
      if (this._isContainer && this._container) {
        this._container.resize(resizeOpts).catch(err => {
          logger.warn('DockerPTYStream: Failed to resize container', { error: err });
        });
      } else if (!this._isContainer && this._exec) {
        this._exec.resize(resizeOpts).catch(err => {
          logger.warn('DockerPTYStream: Failed to resize exec', { error: err });
        });
      }
    } catch (error) {
      logger.warn('DockerPTYStream: Error calling resize', { error });
    }
  }

  public write(data: string): void {
    if (this._stream) {
      this._stream.write(data);
    } else {
      logger.warn('DockerPTYStream: write called but stream is not set');
    }
  }

  public kill(signal?: string): void {
    logger.info('DockerPTYStream: kill called', { signal });
    // If it's a container, we can stop/kill it.
    // If it's an exec, we can't really kill the process easily from outside without another exec,
    // but usually closing the stream is enough or the process handles it.
    
    if (this._isContainer && this._container) {
       // signal is usually a string like 'SIGTERM', Dockerode expects specific signals or just kill
       // IPty kill takes signal string.
       this._container.kill({ signal: signal ?? 'SIGKILL' }).catch(err => {
         // Ignore if container is already stopped/gone
         logger.debug('DockerPTYStream: Failed to kill container (may be already stopped)', { error: err });
       });
    }
    
    // For exec, we can't kill directly via exec object.
    // We can destroy the stream to close connection.
    if (this._stream) {
      this._stream.end();
      // destroying stream might be needed
      if (typeof (this._stream as any).destroy === 'function') {
        (this._stream as any).destroy();
      }
    }
  }

  public onData(listener: (data: string) => void): IDisposable {
    this.on('data', listener);
    return {
      dispose: () => {
        this.removeListener('data', listener);
      }
    };
  }

  public onExit(listener: (e: { exitCode: number; signal?: number }) => void): IDisposable {
    this.on('exit', listener);
    return {
      dispose: () => {
        this.removeListener('exit', listener);
      }
    };
  }

  // Helper for 'on' method from EventEmitter to satisfy IPty interface
  // The IPty interface defines overloads for 'on'.
  // EventEmitter's 'on' is compatible enough for runtime, but TypeScript might complain about return type not being 'this' or similar if strict.
  // node-pty IPty defines `on(event: 'data', ...): void`. EventEmitter returns `this`.
  // This should be fine in TS if we don't strictly check return types or if IPty allows returning something.
  // Actually IPty says `on(...) : void`.
  
  public pause(): void {
    if (this._stream) {
      this._stream.pause();
    }
  }

  public resume(): void {
    if (this._stream) {
      this._stream.resume();
    }
  }

  public clear(): void {
    // No-op for Docker stream? or clear buffer?
    // node-pty clear() clears the pty buffer.
    // We don't really have a buffer to clear in the stream adapter unless we buffer it.
    // Docker exec/attach doesn't expose clear directly.
    logger.debug('DockerPTYStream: clear called (no-op)');
  }
}
