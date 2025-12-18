import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';

/**
 * ランスクリプトの実行オプション
 */
export interface RunOptions {
  /** セッションID */
  sessionId: string;
  /** 作業ディレクトリ（worktreeのパス） */
  workingDirectory: string;
  /** 実行するコマンド */
  command: string;
}

/**
 * ランスクリプトの実行情報
 */
export interface RunInfo {
  /** 実行ID */
  runId: string;
  /** セッションID */
  sessionId: string;
  /** 実行するコマンド */
  command: string;
  /** プロセスID */
  pid: number;
  /** プロセスの状態 */
  status: 'running' | 'stopping' | 'stopped';
  /** 開始時刻 */
  startTime: number;
}

/**
 * プロセスとその情報を保持する内部データ構造
 */
interface ProcessData {
  /** 子プロセス */
  process: ChildProcess;
  /** プロセス情報 */
  info: RunInfo;
  /** 強制終了タイムアウトID */
  killTimeout?: NodeJS.Timeout;
}

/**
 * ランスクリプトのプロセスを管理するクラス
 *
 * このクラスは、複数のランスクリプトプロセスを起動・管理し、
 * 各プロセスの出力、エラー、終了イベントを監視します。
 * EventEmitterを継承しており、以下のイベントを発火します：
 * - 'output': プロセスの標準出力
 * - 'error': プロセスの標準エラー出力
 * - 'exit': プロセスの終了
 *
 * シングルトンパターンを使用して、アプリケーション全体で単一のインスタンスを共有します。
 */
export class RunScriptManager extends EventEmitter {
  private static instance: RunScriptManager | null = null;
  private processes: Map<string, ProcessData> = new Map();

  /**
   * コンストラクタをプライベートにして、外部からのインスタンス化を防ぐ
   */
  private constructor() {
    super();
  }

  /**
   * RunScriptManagerのシングルトンインスタンスを取得
   *
   * @returns RunScriptManagerのインスタンス
   */
  static getInstance(): RunScriptManager {
    if (!RunScriptManager.instance) {
      RunScriptManager.instance = new RunScriptManager();
    }
    return RunScriptManager.instance;
  }

  /**
   * ランスクリプトを実行
   *
   * 指定された作業ディレクトリでコマンドを実行し、run_idを返します。
   * プロセスの出力、エラー、終了をイベントとして発火します。
   *
   * @param options - プロセス起動オプション
   * @returns run_id
   */
  async runScript(options: RunOptions): Promise<string> {
    const { sessionId, workingDirectory, command } = options;
    const runId = randomUUID();

    // コマンドを解析してspawnの引数を準備
    // 常にshellオプションを使用することで、引用符、リダイレクト、パイプなど
    // すべてのシェル機能を一貫して処理できるようにする
    const childProc: ChildProcess = spawn(command, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Wait for process to start successfully
    return new Promise((resolve, reject) => {
      const errorHandler = (error: NodeJS.ErrnoException) => {
        reject(error);
      };

      childProc.on('error', errorHandler);

      childProc.on('spawn', () => {
        // spawn成功後はerrorリスナーを削除
        childProc.removeListener('error', errorHandler);

        if (!childProc.pid) {
          reject(new Error(`Failed to spawn run script process for run ${runId}`));
          return;
        }

        const info: RunInfo = {
          runId,
          sessionId,
          command,
          pid: childProc.pid,
          status: 'running',
          startTime: Date.now(),
        };

        this.processes.set(runId, {
          process: childProc,
          info,
        });

        this.setupProcessListeners(runId, sessionId, childProc, info.startTime);
        resolve(runId);
      });
    });
  }

  /**
   * プロセスのイベントリスナーをセットアップ
   *
   * stdout、stderr、exitイベントをリッスンし、
   * RunScriptManagerのイベントとして再発火します。
   *
   * @param runId - 実行ID
   * @param sessionId - セッションID
   * @param childProc - 監視する子プロセス
   * @param startTime - 開始時刻
   */
  private setupProcessListeners(
    runId: string,
    sessionId: string,
    childProc: ChildProcess,
    startTime: number
  ): void {
    childProc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      this.emit('output', {
        runId,
        sessionId,
        type: 'stdout',
        content: output,
      });
    });

    childProc.stderr?.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      this.emit('error', {
        runId,
        sessionId,
        content: error,
      });
    });

    childProc.on('exit', (exitCode: number | null, signal: string | null) => {
      const processData = this.processes.get(runId);
      if (processData) {
        processData.info.status = 'stopped';
        // タイムアウトをクリア
        if (processData.killTimeout) {
          clearTimeout(processData.killTimeout);
        }
        // メモリリークを防ぐため、終了したプロセスをMapから削除
        this.processes.delete(runId);
      }

      const executionTime = Date.now() - startTime;

      this.emit('exit', {
        runId,
        sessionId,
        exitCode,
        signal,
        executionTime,
      });
    });
  }

  /**
   * プロセスを停止
   *
   * 指定されたrun_idのプロセスにSIGTERMシグナルを送信して停止します。
   * プロセスの状態は'stopping'に更新されます。
   * 5秒経ってもプロセスが終了しない場合はSIGKILLで強制終了します。
   * 実際に'stopped'状態になるのは、プロセスのexitイベントが発火した時です。
   *
   * @param runId - 停止する実行ID
   * @throws run_idが存在しない場合にエラーをスロー
   */
  async stop(runId: string): Promise<void> {
    const processData = this.processes.get(runId);
    if (!processData) {
      throw new Error(`Run script ${runId} not found`);
    }

    // Try graceful shutdown first (SIGTERM)
    processData.info.status = 'stopping';
    processData.process.kill('SIGTERM');

    // Set a timeout to force kill if process doesn't exit
    processData.killTimeout = setTimeout(() => {
      const currentData = this.processes.get(runId);
      if (currentData) {
        currentData.process.kill('SIGKILL');
      }
    }, 5000); // 5 seconds grace period
  }

  /**
   * プロセスの状態を取得
   *
   * 指定されたrun_idのプロセス情報を取得します。
   *
   * @param runId - 状態を取得する実行ID
   * @returns プロセス情報、またはrun_idが存在しない場合はnull
   */
  getStatus(runId: string): RunInfo | null {
    const processData = this.processes.get(runId);
    if (!processData) {
      return null;
    }

    return processData.info;
  }
}

/**
 * RunScriptManagerのシングルトンインスタンスを取得
 *
 * アプリケーション全体で単一のRunScriptManagerインスタンスを共有します。
 * これにより、WebSocketハンドラーやAPIルートから同じプロセス管理にアクセスできます。
 * 初回呼び出し時にインスタンスを作成し、以降は同じインスタンスを返します。
 *
 * @returns RunScriptManagerのシングルトンインスタンス
 */
export function getRunScriptManager(): RunScriptManager {
  return RunScriptManager.getInstance();
}
