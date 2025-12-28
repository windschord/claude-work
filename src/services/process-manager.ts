import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

/**
 * Claude Codeプロセスの起動オプション
 */
export interface StartOptions {
  /** セッションID */
  sessionId: string;
  /** worktreeのパス */
  worktreePath: string;
  /** Claude Codeに送信する初期プロンプト（オプション） */
  prompt?: string;
  /** 使用するモデル名（オプション） */
  model?: string;
  /** 再開するClaude CodeセッションID（--resumeオプション用） */
  resumeSessionId?: string;
}

/**
 * プロセスの情報
 */
export interface ProcessInfo {
  /** セッションID */
  sessionId: string;
  /** プロセスID */
  pid: number;
  /** プロセスの状態 */
  status: 'running' | 'stopped';
}

/**
 * プロセスとその情報を保持する内部データ構造
 */
interface ProcessData {
  /** 子プロセス */
  process: ChildProcess;
  /** プロセス情報 */
  info: ProcessInfo;
}

/**
 * Claude Codeプロセスを管理するクラス
 *
 * このクラスは、複数のClaude Codeプロセスを起動・管理し、
 * 各プロセスの出力、エラー、権限リクエスト、終了イベントを監視します。
 * EventEmitterを継承しており、以下のイベントを発火します：
 * - 'output': プロセスの標準出力
 * - 'error': プロセスの標準エラー出力
 * - 'permission': 権限リクエスト
 * - 'exit': プロセスの終了
 *
 * シングルトンパターンを使用して、アプリケーション全体で単一のインスタンスを共有します。
 */

/**
 * グローバルスコープでProcessManagerインスタンスを保持するための型定義
 * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため
 */
declare global {
  // eslint-disable-next-line no-var
  var processManager: ProcessManager | undefined;
}

export class ProcessManager extends EventEmitter {
  private static instance: ProcessManager | null = null;
  private processes: Map<string, ProcessData> = new Map();

  /**
   * コンストラクタをプライベートにして、外部からのインスタンス化を防ぐ
   */
  private constructor() {
    super();
  }

  /**
   * ProcessManagerのシングルトンインスタンスを取得
   *
   * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため、
   * globalThisに保存します。
   *
   * @returns ProcessManagerのインスタンス
   */
  static getInstance(): ProcessManager {
    // globalThisから取得を試みる（Next.js Hot Reload対策）
    if (globalThis.processManager) {
      return globalThis.processManager;
    }

    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }

    // 開発環境ではglobalThisに保存
    if (process.env.NODE_ENV !== 'production') {
      globalThis.processManager = ProcessManager.instance;
    }

    return ProcessManager.instance;
  }

  /**
   * テスト用: シングルトンインスタンスと全プロセスをリセット
   *
   * このメソッドはテストでのみ使用してください。
   * プロダクションコードでは使用しないでください。
   *
   * @remarks
   * シングルトンインスタンスをnullに設定することで、次回のgetInstance()呼び出し時に
   * 新しいインスタンスが生成されます。これにより、テスト間での完全な分離が保証されます。
   * static property type `ProcessManager | null` は、この動作を型安全に実現するために必要です。
   */
  static resetForTesting(): void {
    if (ProcessManager.instance) {
      // 全プロセスを強制終了
      for (const [, processData] of ProcessManager.instance.processes) {
        try {
          processData.process.kill();
        } catch {
          // Ignore errors
        }
      }
      ProcessManager.instance.processes.clear();
      ProcessManager.instance.removeAllListeners();
      // シングルトンをnullにリセット（次回getInstance()で新しいインスタンスを生成）
      ProcessManager.instance = null;
      // globalThisからも削除
      globalThis.processManager = undefined;
    }
  }

  /**
   * Claude Codeプロセスを起動
   *
   * 指定されたworktreeでClaude Codeを起動し、初期プロンプトを送信します。
   * プロセスの出力、エラー、権限リクエスト、終了をイベントとして発火します。
   *
   * @param options - プロセス起動オプション
   * @returns プロセス情報
   * @throws 同じsessionIdのプロセスが既に存在する場合にエラーをスロー
   */
  async startClaudeCode(options: StartOptions): Promise<ProcessInfo> {
    const { sessionId, worktreePath, prompt, model, resumeSessionId } = options;

    if (this.processes.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const args = ['--print'];
    if (model) {
      args.push('--model', model);
    }
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    const childProc = spawn(claudeCodePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: worktreePath,
    });

    // Handle spawn errors (e.g., ENOENT) asynchronously
    return new Promise((resolve, reject) => {
      childProc.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          reject(new Error('Claude Codeが見つかりません。環境変数CLAUDE_CODE_PATHを確認してください。'));
        } else {
          reject(error);
        }
      });

      // Wait for process to start successfully
      childProc.on('spawn', () => {
        if (!childProc.pid) {
          reject(new Error(`Failed to spawn Claude Code process for session ${sessionId}`));
          return;
        }

        const info: ProcessInfo = {
          sessionId,
          pid: childProc.pid,
          status: 'running',
        };

        this.processes.set(sessionId, {
          process: childProc,
          info,
        });

        this.setupProcessListeners(sessionId, childProc);

        // promptが指定されている場合のみstdinに書き込む
        if (prompt !== undefined && prompt !== '') {
          childProc.stdin.write(`${prompt}\n`);
        }

        resolve(info);
      });
    });

  }

  /**
   * プロセスのイベントリスナーをセットアップ
   *
   * stdout、stderr、exitイベントをリッスンし、
   * ProcessManagerのイベントとして再発火します。
   * stdoutの出力がJSON形式の権限リクエストの場合は、
   * 'permission'イベントとして発火します。
   *
   * @param sessionId - セッションID
   * @param childProc - 監視する子プロセス
   */
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
        // メモリリークを防ぐため、終了したプロセスをMapから削除
        this.processes.delete(sessionId);
      }

      this.emit('exit', {
        sessionId,
        exitCode,
        signal,
      });
    });
  }

  /**
   * プロセスに入力を送信
   *
   * 指定されたセッションのプロセスの標準入力に文字列を送信します。
   * 入力の末尾には自動的に改行文字が追加されます。
   *
   * @param sessionId - 入力を送信するセッションID
   * @param input - 送信する入力文字列
   * @throws セッションが存在しない、またはstdinが利用できない場合にエラーをスロー
   */
  async sendInput(sessionId: string, input: string): Promise<void> {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!processData.process.stdin) {
      throw new Error(`Session ${sessionId} stdin is not available`);
    }

    processData.process.stdin.write(`${input}\n`);
  }

  /**
   * プロセスを停止
   *
   * 指定されたセッションのプロセスにSIGTERMシグナルを送信して停止します。
   * プロセスの状態は'stopped'に更新されます。
   *
   * @param sessionId - 停止するセッションID
   * @throws セッションが存在しない場合にエラーをスロー
   */
  async stop(sessionId: string): Promise<void> {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    processData.process.kill();
    processData.info.status = 'stopped';
  }

  /**
   * プロセスの状態を取得
   *
   * 指定されたセッションのプロセス情報を取得します。
   *
   * @param sessionId - 状態を取得するセッションID
   * @returns プロセス情報、またはセッションが存在しない場合はnull
   */
  getStatus(sessionId: string): ProcessInfo | null {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      return null;
    }

    return processData.info;
  }

  /**
   * プロセスが実行中かどうかを確認
   *
   * 指定されたセッションのプロセスが存在するかどうかを確認します。
   *
   * @param sessionId - 確認するセッションID
   * @returns プロセスが実行中の場合はtrue、それ以外はfalse
   */
  hasProcess(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  /**
   * プロセスを停止してMapから削除
   *
   * ProcessLifecycleManagerから使用されるメソッド。
   * プロセスが存在しない場合は何もしません。
   *
   * @param sessionId - 停止するセッションID
   */
  async stopProcess(sessionId: string): Promise<void> {
    const processData = this.processes.get(sessionId);
    if (!processData) {
      return;
    }

    processData.process.kill();
    this.processes.delete(sessionId);
  }

  /**
   * アクティブなプロセス一覧を取得
   *
   * 現在実行中のすべてのプロセスのMapを返します。
   * ProcessLifecycleManagerでシャットダウン時に使用されます。
   *
   * @returns セッションIDをキーとするProcessInfoのMap
   */
  getActiveProcesses(): Map<string, ProcessInfo> {
    const result = new Map<string, ProcessInfo>();
    for (const [sessionId, processData] of this.processes) {
      result.set(sessionId, processData.info);
    }
    return result;
  }
}

/**
 * ProcessManagerのシングルトンインスタンスを取得
 *
 * アプリケーション全体で単一のProcessManagerインスタンスを共有します。
 * これにより、WebSocketハンドラーやAPIルートから同じプロセス管理にアクセスできます。
 * 初回呼び出し時にインスタンスを作成し、以降は同じインスタンスを返します。
 *
 * @returns ProcessManagerのシングルトンインスタンス
 */
export function getProcessManager(): ProcessManager {
  return ProcessManager.getInstance();
}
