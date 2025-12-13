import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

export interface StartOptions {
  sessionId: string;
  worktreePath: string;
  prompt: string;
  model?: string;
}

export interface ProcessInfo {
  sessionId: string;
  pid: number;
  status: 'running' | 'stopped';
}

interface ProcessData {
  process: ChildProcess;
  info: ProcessInfo;
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessData> = new Map();

  async startClaudeCode(options: StartOptions): Promise<ProcessInfo> {
    const { sessionId, worktreePath, prompt, model } = options;

    if (this.processes.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const args = ['--print'];
    if (model) {
      args.push('--model', model);
    }
    args.push('--cwd', worktreePath);

    const childProc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const info: ProcessInfo = {
      sessionId,
      pid: childProc.pid!,
      status: 'running',
    };

    this.processes.set(sessionId, {
      process: childProc,
      info,
    });

    this.setupProcessListeners(sessionId, childProc);

    childProc.stdin.write(`${prompt}\n`);

    return info;
  }

  private setupProcessListeners(sessionId: string, childProc: ChildProcess): void {
    childProc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();

      try {
        const json = JSON.parse(output);
        if (json.type === 'permission_request') {
          this.emit('permission', {
            sessionId,
            requestId: json.requestId,
            action: json.action,
            details: json.details,
          });
          return;
        }
      } catch {
        // Not JSON, treat as normal output
      }

      this.emit('output', {
        sessionId,
        type: 'output',
        content: output,
      });
    });

    childProc.stderr?.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      this.emit('error', {
        sessionId,
        content: error,
      });
    });

    childProc.on('exit', (exitCode: number | null, signal: string | null) => {
      const processData = this.processes.get(sessionId);
      if (processData) {
        processData.info.status = 'stopped';
      }

      this.emit('exit', {
        sessionId,
        exitCode,
        signal,
      });
    });
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    processData.process.stdin.write(`${input}\n`);
  }

  async stop(sessionId: string): Promise<void> {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    processData.process.kill();
    processData.info.status = 'stopped';
  }

  getStatus(sessionId: string): ProcessInfo | null {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      return null;
    }

    return processData.info;
  }
}
