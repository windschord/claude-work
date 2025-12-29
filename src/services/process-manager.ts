import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { logger } from '@/lib/logger';

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
    // globalThisから取得を試みる（モジュール間でシングルトンを共有）
    if (globalThis.processManager) {
      return globalThis.processManager;
    }

    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }

    // globalThisに保存（本番環境でもモジュール間で共有するため）
    globalThis.processManager = ProcessManager.instance;

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

    // stream-jsonフォーマットで双方向通信を有効にする
    // --output-format=stream-json には --verbose が必要
    const args = ['--print', '--verbose', '--input-format', 'stream-json', '--output-format', 'stream-json'];
    // "auto" はアプリケーション独自の値で、Claude CLIには渡さない
    // Claude CLIのデフォルトモデルを使用する
    if (model && model !== 'auto') {
      args.push('--model', model);
    }
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    logger.info('Starting Claude process', { sessionId, claudeCodePath, args, worktreePath });

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
        // stream-json形式では以下の形式でメッセージを送信する:
        // {"type":"user","message":{"role":"user","content":"..."},"session_id":"default","parent_tool_use_id":null}
        if (prompt !== undefined && prompt !== '') {
          const jsonMessage = JSON.stringify({
            type: 'user',
            message: { role: 'user', content: prompt },
            session_id: 'default',
            parent_tool_use_id: null,
          });
          childProc.stdin.write(`${jsonMessage}\n`);
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
   * stream-json形式の出力はNDJSON（改行区切りのJSON）として処理します。
   *
   * @param sessionId - セッションID
   * @param childProc - 監視する子プロセス
   */
  private setupProcessListeners(sessionId: string, childProc: ChildProcess): void {
    // NDJSON用のバッファ（複数のdataイベントにまたがるJSONを処理するため）
    let buffer = '';

    childProc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // 改行で分割してNDJSONを処理
      const lines = buffer.split('\n');
      // 最後の行は不完全な可能性があるのでバッファに保持
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const json = JSON.parse(trimmedLine);
          this.handleStreamJsonMessage(sessionId, json);
        } catch {
          // JSONパースに失敗した場合はそのまま出力
          this.emit('output', {
            sessionId,
            type: 'output',
            content: trimmedLine,
          });
        }
      }
    });

    childProc.stderr?.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      logger.error('Claude process stderr', { sessionId, error });
      this.emit('error', {
        sessionId,
        content: error,
      });
    });

    childProc.on('exit', (exitCode: number | null, signal: string | null) => {
      logger.info('Claude process exited', { sessionId, exitCode, signal, remainingBuffer: buffer.trim() });

      // バッファに残っているデータを処理
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer.trim());
          this.handleStreamJsonMessage(sessionId, json);
        } catch {
          this.emit('output', {
            sessionId,
            type: 'output',
            content: buffer.trim(),
          });
        }
      }

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
   * stream-json形式のメッセージを処理
   *
   * Claude CLIのstream-json出力には以下のタイプがあります:
   * - assistant: アシスタントの応答テキスト
   * - system: システムメッセージ
   * - result: 最終結果
   * - permission_request: 権限リクエスト
   *
   * @param sessionId - セッションID
   * @param json - パースされたJSONオブジェクト
   */
  private handleStreamJsonMessage(sessionId: string, json: Record<string, unknown>): void {
    const messageType = json.type as string;
    logger.debug('Received stream-json message', { sessionId, messageType, json });

    switch (messageType) {
      case 'permission_request':
        this.emit('permission', {
          sessionId,
          requestId: json.requestId,
          action: json.action,
          details: json.details,
        });
        break;

      case 'assistant':
        // アシスタントの応答メッセージ
        if (json.message && typeof json.message === 'object') {
          const message = json.message as Record<string, unknown>;
          const content = message.content;
          if (Array.isArray(content)) {
            // content配列からテキストを抽出
            for (const block of content) {
              if (typeof block === 'object' && block !== null) {
                const textBlock = block as Record<string, unknown>;
                if (textBlock.type === 'text' && typeof textBlock.text === 'string') {
                  this.emit('output', {
                    sessionId,
                    type: 'output',
                    content: textBlock.text,
                  });
                }
              }
            }
          }
        }
        break;

      case 'content_block_delta':
        // ストリーミング中のテキストデルタ
        if (json.delta && typeof json.delta === 'object') {
          const delta = json.delta as Record<string, unknown>;
          if (delta.type === 'text_delta' && typeof delta.text === 'string') {
            this.emit('output', {
              sessionId,
              type: 'output',
              content: delta.text,
            });
          }
        }
        break;

      case 'result':
        // 最終結果 - assistantメッセージで既にテキストは送信済みなのでスキップ
        // resultは会話の完了を示すのみ
        logger.debug('Stream-json result received (skipped)', { sessionId });
        break;

      case 'system':
        // システムメッセージ
        if (json.message && typeof json.message === 'string') {
          this.emit('output', {
            sessionId,
            type: 'output',
            content: `[System] ${json.message}`,
          });
        }
        break;

      case 'error':
        // エラーメッセージ
        this.emit('error', {
          sessionId,
          content: JSON.stringify(json),
        });
        break;

      case 'user':
        // userタイプはClaude CLIが会話履歴として出力するもの
        // クライアントには既にユーザー入力が表示されているため、無視する
        logger.debug('Stream-json user message received (ignored)', { sessionId });
        break;

      default:
        // 認識されないメッセージタイプはログのみ出力し、クライアントには送信しない
        logger.debug('Unknown stream-json message type (ignored)', {
          sessionId,
          messageType,
          json,
        });
    }
  }

  /**
   * プロセスに入力を送信
   *
   * 指定されたセッションのプロセスの標準入力にJSON形式でメッセージを送信します。
   * stream-json形式では、以下の形式で送信します:
   * {"type":"user","message":{"role":"user","content":"..."},"session_id":"default","parent_tool_use_id":null}
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

    // stream-json形式でJSON形式のメッセージを送信
    const jsonMessage = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: input },
      session_id: 'default',
      parent_tool_use_id: null,
    });
    processData.process.stdin.write(`${jsonMessage}\n`);
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
