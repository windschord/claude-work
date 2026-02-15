import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { logger } from '@/lib/logger';
import type {
  EnvironmentAdapter,
  CreateSessionOptions,
} from '../environment-adapter';

/**
 * BasePTYAdapter
 *
 * HOST/DOCKER環境で共通のPTYロジックを提供する抽象基底クラス。
 * - PTYプロセスの生成(spawnPTY)
 * - データハンドラー設定(setupDataHandlers)
 * - エラーハンドラー設定(setupErrorHandlers)
 * - PTYクリーンアップ(cleanupPTY)
 * - ClaudeセッションID抽出(extractClaudeSessionId)
 *
 * 継承先で実装すべき抽象メソッド:
 * - createSession(): セッション作成
 * - destroySession(): セッション終了
 */
export abstract class BasePTYAdapter
  extends EventEmitter
  implements EnvironmentAdapter
{
  /**
   * PTYプロセスを生成
   *
   * @param command - 実行コマンド
   * @param args - コマンド引数
   * @param options - PTYオプション
   * @returns IPtyインスタンス
   */
  protected spawnPTY(
    command: string,
    args: string[],
    options: {
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    }
  ): IPty {
    const { cols = 80, rows = 24, cwd, env = {} } = options;

    // argsをサニタイズ（機密情報を含む可能性があるため）
    const sanitizedArgs = args.map((arg) => {
      if (arg.startsWith('--')) {
        const [flag, value] = arg.split('=', 2);
        if (value !== undefined && value.length > 0) {
          return `${flag}=REDACTED`;
        }
        return flag;
      }
      // 位置引数やフラグ以外の引数は機密情報を含む可能性がある
      return 'REDACTED';
    });

    logger.info('Spawning PTY process', {
      command,
      cols,
      rows,
      cwd,
    });

    logger.debug('Spawning PTY process with args', {
      command,
      args: sanitizedArgs,
      cols,
      rows,
      cwd,
    });

    // CLAUDECODEを除外してネストされたセッションを防ぐ
    const { CLAUDECODE: _CLAUDECODE, ...inheritedEnv } = process.env;
    return pty.spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...inheritedEnv,
        ...env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });
  }

  /**
   * PTYデータハンドラーを設定
   *
   * PTYからの出力を受け取り、'data'イベントを発火する。
   * ClaudeセッションIDが検出された場合、'claudeSessionId'イベントも発火する。
   *
   * @param ptyInstance - IPtyインスタンス
   * @param sessionId - セッションID
   */
  protected setupDataHandlers(ptyInstance: IPty, sessionId: string): void {
    ptyInstance.onData((data: string) => {
      this.emit('data', sessionId, data);

      // SessionID抽出を試みる
      const extracted = this.extractClaudeSessionId(data);
      if (extracted) {
        logger.info('Claude session ID extracted', {
          sessionId,
          claudeSessionId: extracted,
        });
        this.emit('claudeSessionId', sessionId, extracted);
      }
    });
  }

  /**
   * PTYエラーハンドラーを設定
   *
   * PTYプロセス終了時に'exit'イベントを発火する。
   *
   * @param ptyInstance - IPtyインスタンス
   * @param sessionId - セッションID
   */
  protected setupErrorHandlers(ptyInstance: IPty, sessionId: string): void {
    ptyInstance.onExit(
      ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        logger.info('PTY process exited', {
          sessionId,
          exitCode,
          signal,
        });
        this.emit('exit', sessionId, { exitCode, signal });
      }
    );
  }

  /**
   * PTYプロセスをクリーンアップ
   *
   * PTYプロセスを終了し、リスナーを削除する。
   *
   * @param ptyInstance - IPtyインスタンス
   */
  protected async cleanupPTY(ptyInstance: IPty): Promise<void> {
    logger.info('Cleaning up PTY process');
    ptyInstance.kill();
    // Note: IPty does not have removeAllListeners method
    // Listeners are automatically cleaned up when the process is killed
  }

  /**
   * Claude Code出力からセッションIDを抽出
   *
   * 対応形式の例:
   * - "Session ID: <uuid>"
   * - "session: <id>"
   * - "[session:<id>]"
   *
   * @param data - PTY出力データ
   * @returns 抽出されたセッションID、見つからない場合はnull
   */
  protected extractClaudeSessionId(data: string): string | null {
    // 既存形式と、他アダプターで利用されている形式の両方をサポートする
    const patterns: RegExp[] = [
      // 既存形式: "Session ID: <uuid>"
      /Session ID:\s*([a-f0-9-]{36})/i,
      // 一般的な形式: "session: <id>"
      /\bsession:\s*([^\s\]]+)/i,
      // ブラケット形式: "[session:<id>]"
      /\[session:([^\]\s]+)\]/i,
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  // ===============================
  // 抽象メソッド(継承先で実装)
  // ===============================

  /**
   * セッションを作成
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ
   * @param initialPrompt - 初期プロンプト（任意）
   * @param options - 追加オプション
   */
  abstract createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void | Promise<void>;

  /**
   * セッションを終了
   *
   * @param sessionId - セッションID
   */
  abstract destroySession(sessionId: string): void | Promise<void>;

  // ===============================
  // EnvironmentAdapterインターフェース実装
  // ===============================

  /**
   * PTYに入力を送信
   *
   * @param sessionId - セッションID
   * @param data - 送信データ
   * @throws Error - 基底クラスでは実装されていない
   */
  write(_sessionId: string, _data: string): void {
    throw new Error('write() must be implemented in subclass');
  }

  /**
   * PTYのサイズを変更
   *
   * @param sessionId - セッションID
   * @param cols - 列数
   * @param rows - 行数
   * @throws Error - 基底クラスでは実装されていない
   */
  resize(_sessionId: string, _cols: number, _rows: number): void {
    throw new Error('resize() must be implemented in subclass');
  }

  /**
   * セッションを再起動
   *
   * @param sessionId - セッションID
   * @param workingDir - フォールバック用作業ディレクトリ
   * @throws Error - 基底クラスでは実装されていない
   */
  restartSession(_sessionId: string, _workingDir?: string): void | Promise<void> {
    throw new Error('restartSession() must be implemented in subclass');
  }

  /**
   * セッションが存在するか確認
   *
   * @param sessionId - セッションID
   * @returns セッションが存在する場合true
   * @throws Error - 基底クラスでは実装されていない
   */
  hasSession(_sessionId: string): boolean {
    throw new Error('hasSession() must be implemented in subclass');
  }

  /**
   * セッションの作業ディレクトリを取得
   *
   * @param sessionId - セッションID
   * @returns 作業ディレクトリ、見つからない場合はundefined
   * @throws Error - 基底クラスでは実装されていない
   */
  getWorkingDir(_sessionId: string): string | undefined {
    throw new Error('getWorkingDir() must be implemented in subclass');
  }
}
