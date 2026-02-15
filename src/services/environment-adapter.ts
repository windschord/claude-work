import { EventEmitter } from 'events';
import type { ClaudeCodeOptions, CustomEnvVars } from './claude-options-service';

/**
 * セッション作成オプション
 */
export interface CreateSessionOptions {
  resumeSessionId?: string;
  /** シェルモード（Terminal用）: trueの場合、Claude Codeではなくシェルを起動 */
  shellMode?: boolean;
  /** Claude Code CLIオプション */
  claudeCodeOptions?: ClaudeCodeOptions;
  /** カスタム環境変数 */
  customEnvVars?: CustomEnvVars;
  /** ターミナル列数（初期サイズ） */
  cols?: number;
  /** ターミナル行数（初期サイズ） */
  rows?: number;
}

/**
 * PTYプロセス終了情報
 */
export interface PTYExitInfo {
  exitCode: number;
  signal?: number;
}

/**
 * 実行環境アダプターインターフェース
 *
 * HOST、Docker、SSH等の実行環境を抽象化するインターフェース。
 * 各実装はこのインターフェースを通じて同一の操作を提供する。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: PTYExitInfo)
 * - 'error': エラー発生 (sessionId: string, error: Error)
 * - 'claudeSessionId': Claude CodeセッションID抽出 (sessionId: string, claudeSessionId: string)
 */
export interface EnvironmentAdapter extends EventEmitter {
  /**
   * セッションを作成
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ
   * @param initialPrompt - 初期プロンプト（任意）
   * @param options - 追加オプション
   * @returns void または Promise<void>（非同期実装の場合）
   */
  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void | Promise<void>;

  /**
   * PTYに入力を送信
   * @param sessionId - セッションID
   * @param data - 送信データ
   */
  write(sessionId: string, data: string): void;

  /**
   * PTYのサイズを変更
   * @param sessionId - セッションID
   * @param cols - 列数
   * @param rows - 行数
   */
  resize(sessionId: string, cols: number, rows: number): void;

  /**
   * セッションを終了
   * @param sessionId - セッションID
   * @returns void または Promise<void>（非同期実装の場合）
   */
  destroySession(sessionId: string): void | Promise<void>;

  /**
   * セッションを再起動
   * @param sessionId - セッションID
   * @param workingDir - フォールバック用作業ディレクトリ（セッションがメモリにない場合に使用）
   * @returns void または Promise<void>（非同期実装の場合）
   */
  restartSession(sessionId: string, workingDir?: string): void | Promise<void>;

  /**
   * セッションが存在するか確認
   * @param sessionId - セッションID
   */
  hasSession(sessionId: string): boolean;

  /**
   * セッションの作業ディレクトリを取得
   * @param sessionId - セッションID
   */
  getWorkingDir(sessionId: string): string | undefined;
}

/**
 * EnvironmentAdapterの型ガード
 */
export function isEnvironmentAdapter(obj: unknown): obj is EnvironmentAdapter {
  if (!obj || typeof obj !== 'object') return false;
  const adapter = obj as Record<string, unknown>;
  return (
    typeof adapter.createSession === 'function' &&
    typeof adapter.write === 'function' &&
    typeof adapter.resize === 'function' &&
    typeof adapter.destroySession === 'function' &&
    typeof adapter.restartSession === 'function' &&
    typeof adapter.hasSession === 'function' &&
    typeof adapter.getWorkingDir === 'function' &&
    typeof adapter.on === 'function' &&
    typeof adapter.emit === 'function'
  );
}
