import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@/lib/logger';
import { DockerPTYAdapter, CreateDockerPTYSessionOptions } from './docker-pty-adapter';

/**
 * Claude PTYセッション作成オプション
 */
export interface CreateClaudePTYSessionOptions {
  resumeSessionId?: string; // Claude Codeの--resume用セッションID
  dockerMode?: boolean; // Dockerコンテナ内でClaude Codeを実行
}

/**
 * Claude PTYセッション情報
 */
interface ClaudePTYSession {
  ptyProcess: pty.IPty;
  sessionId: string;
  workingDir: string;
  initialPrompt?: string;
  claudeSessionId?: string; // Claude Codeが出力するセッションID
  options?: CreateClaudePTYSessionOptions; // 再起動時にオプションを保持するため
}

/**
 * PTYプロセス終了情報
 */
export interface ClaudePTYExitInfo {
  exitCode: number;
  signal?: number;
}

/**
 * Claude PTY用の安全な環境変数を構築
 */
function buildClaudePtyEnv(): Record<string, string> {
  const allow = new Set([
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'LANG',
    'LC_ALL',
    'TERM',
    'COLORTERM',
    'TMPDIR',
    'TEMP',
    'TMP',
    'NODE_ENV',
    // Claude Code用の環境変数
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
  ]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (!allow.has(k)) continue;
    out[k] = v;
  }
  // ターミナル設定を追加
  out['TERM'] = 'xterm-256color';
  out['COLORTERM'] = 'truecolor';
  return out;
}

/**
 * ClaudePTYManager
 *
 * Claude CodeプロセスをPTYで管理するサービス。
 * 対話モードでClaude Codeを起動し、ターミナルとして直接操作可能にする。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: ClaudePTYExitInfo)
 * - 'error': エラー発生 (sessionId: string, error: Error)
 */
class ClaudePTYManager extends EventEmitter {
  private sessions: Map<string, ClaudePTYSession> = new Map();
  private creating: Set<string> = new Set();
  private claudePath: string;
  private dockerAdapter: DockerPTYAdapter;

  constructor() {
    super();
    this.claudePath = process.env.CLAUDE_CODE_PATH || 'claude';
    this.dockerAdapter = new DockerPTYAdapter();

    // DockerPTYAdapterからのイベントを中継
    this.dockerAdapter.on('data', (sessionId: string, data: string) => {
      this.emit('data', sessionId, data);
    });
    this.dockerAdapter.on('exit', (sessionId: string, info: ClaudePTYExitInfo) => {
      this.emit('exit', sessionId, info);
    });
    this.dockerAdapter.on('error', (sessionId: string, error: Error) => {
      this.emit('error', sessionId, error);
    });
    this.dockerAdapter.on('claudeSessionId', (sessionId: string, claudeSessionId: string) => {
      this.emit('claudeSessionId', sessionId, claudeSessionId);
    });
  }

  /**
   * Claude Codeプロセスを作成
   *
   * 注意: このメソッドは同一sessionIdに対して同時に呼び出すべきではありません。
   * Node.jsはシングルスレッドですが、非同期コールバックにより競合が発生する可能性があります。
   * createSession呼び出しは必ず直列化してください。
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ（worktreeパス）
   * @param initialPrompt - 初期プロンプト（任意）
   * @param options - 追加オプション（resumeSessionIdなど）
   * @throws 同一sessionIdで作成中の場合、またはworkingDirが無効な場合
   */
  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateClaudePTYSessionOptions
  ): void {
    // Dockerモードの場合はDockerPTYAdapterに委譲
    if (options?.dockerMode) {
      logger.info('Creating Docker PTY session (delegating to DockerPTYAdapter)', {
        sessionId,
        workingDir,
      });
      const dockerOptions: CreateDockerPTYSessionOptions = {
        resumeSessionId: options.resumeSessionId,
      };
      this.dockerAdapter.createSession(sessionId, workingDir, initialPrompt, dockerOptions);
      return;
    }

    // 作成中のセッションがある場合はエラー
    // Note: Node.jsはシングルスレッドのため、hasとaddの間に他のcreateSession呼び出しが割り込むことはありません。
    // ただし、このメソッドを同一sessionIdに対して同時に呼び出すことは避けてください。
    if (this.creating.has(sessionId)) {
      throw new Error(`Claude PTY creation already in progress for session ${sessionId}`);
    }

    // 既存のセッションがあればクリーンアップ
    if (this.sessions.has(sessionId)) {
      this.destroySession(sessionId);
    }

    // 作成中フラグを立てる
    this.creating.add(sessionId);

    // workingDirの検証
    const resolvedCwd = path.resolve(workingDir);
    let st: fs.Stats;
    try {
      st = fs.statSync(resolvedCwd);
    } catch {
      this.creating.delete(sessionId);
      throw new Error(`workingDir does not exist: ${resolvedCwd}`);
    }
    if (!st.isDirectory()) {
      this.creating.delete(sessionId);
      throw new Error(`workingDir is not a directory: ${resolvedCwd}`);
    }

    try {
      // Claude CLIの引数を構築
      const cliArgs: string[] = [];
      if (options?.resumeSessionId) {
        cliArgs.push('--resume', options.resumeSessionId);
        logger.info('Creating Claude PTY session with resume', {
          sessionId,
          workingDir: resolvedCwd,
          resumeSessionId: options.resumeSessionId,
        });
      } else {
        logger.info('Creating Claude PTY session', { sessionId, workingDir: resolvedCwd });
      }

      // Claude Codeプロセスを生成（対話モード）
      const ptyProcess = pty.spawn(this.claudePath, cliArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: resolvedCwd,
        env: buildClaudePtyEnv(),
      });

      // セッションを登録（再起動時にオプションを保持するため、optionsも保存）
      this.sessions.set(sessionId, {
        ptyProcess,
        sessionId,
        workingDir: resolvedCwd,
        initialPrompt,
        options,
      });
      // 作成完了フラグをクリア
      this.creating.delete(sessionId);

      // PTY出力をイベントとして発火
      // Claude Code出力からセッションIDを抽出
      ptyProcess.onData((data: string) => {
        this.emit('data', sessionId, data);

        // セッションIDの抽出（まだ取得していない場合）
        const session = this.sessions.get(sessionId);
        if (session && !session.claudeSessionId) {
          const extractedId = this.extractClaudeSessionId(data);
          if (extractedId) {
            session.claudeSessionId = extractedId;
            logger.info('Claude session ID extracted', {
              sessionId,
              claudeSessionId: extractedId,
            });
            this.emit('claudeSessionId', sessionId, extractedId);
          }
        }
      });

      // PTY終了時の処理
      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info('Claude PTY exited', { sessionId, exitCode, signal });
        this.emit('exit', sessionId, { exitCode, signal });
        this.sessions.delete(sessionId);
      });

      // 初期プロンプトがあれば送信（Claude Codeの起動を待ってから）
      // Claude Codeは起動時に設定読み込み、API接続などを行うため、3秒待機
      if (initialPrompt) {
        logger.info('Initial prompt will be sent after delay', {
          sessionId,
          promptLength: initialPrompt.length,
        });
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            logger.info('Sending initial prompt to Claude Code', {
              sessionId,
              promptPreview: initialPrompt.substring(0, 100),
            });
            ptyProcess.write(initialPrompt + '\n');
          } else {
            logger.warn('Session no longer exists, skipping initial prompt', { sessionId });
          }
        }, 3000); // Claude Codeの起動を待つ（3秒）
      }

      logger.info('Claude PTY session created', { sessionId });
    } catch (error) {
      // エラー時も作成中フラグをクリア
      this.creating.delete(sessionId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create Claude PTY session', { sessionId, error: errorMessage });
      this.emit('error', sessionId, new Error(`Failed to spawn Claude process: ${errorMessage}`));
      throw new Error(
        `Failed to spawn Claude process for session ${sessionId}: ${errorMessage}`
      );
    }
  }

  /**
   * PTYに入力を送信
   *
   * @param sessionId - セッションID
   * @param data - 入力データ
   */
  write(sessionId: string, data: string): void {
    // Dockerセッションの場合はDockerPTYAdapterに委譲
    if (this.dockerAdapter.hasSession(sessionId)) {
      this.dockerAdapter.write(sessionId, data);
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.write(data);
    }
  }

  /**
   * PTYのサイズを変更
   *
   * @param sessionId - セッションID
   * @param cols - 列数
   * @param rows - 行数
   */
  resize(sessionId: string, cols: number, rows: number): void {
    // Dockerセッションの場合はDockerPTYAdapterに委譲
    if (this.dockerAdapter.hasSession(sessionId)) {
      this.dockerAdapter.resize(sessionId, cols, rows);
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * セッションを終了
   *
   * @param sessionId - セッションID
   */
  destroySession(sessionId: string): void {
    // Dockerセッションの場合はDockerPTYAdapterに委譲
    if (this.dockerAdapter.hasSession(sessionId)) {
      this.dockerAdapter.destroySession(sessionId);
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('Destroying Claude PTY session', { sessionId });
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * セッションを再起動
   *
   * @param sessionId - セッションID
   * @param workingDir - フォールバック用作業ディレクトリ（セッションがメモリにない場合に使用）
   * @param initialPrompt - フォールバック用初期プロンプト
   * @param options - フォールバック用オプション
   */
  restartSession(sessionId: string, workingDir?: string, initialPrompt?: string, options?: CreateClaudePTYSessionOptions): void {
    // Dockerセッションの場合はDockerPTYAdapterに委譲
    if (this.dockerAdapter.hasSession(sessionId)) {
      this.dockerAdapter.restartSession(sessionId);
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir: wd, initialPrompt: ip, options: opts } = session;
      logger.info('Restarting Claude PTY session', { sessionId, dockerMode: opts?.dockerMode });
      this.destroySession(sessionId);
      // 少し待ってから再作成（オプションを保持して再起動）
      setTimeout(() => {
        this.createSession(sessionId, wd, ip, opts);
      }, 500);
    } else if (workingDir) {
      // セッションがメモリにない場合（exit後など）、引数のworkingDirで再作成
      logger.info('Restarting Claude PTY session (from fallback params)', { sessionId });
      setTimeout(() => {
        try {
          this.createSession(sessionId, workingDir, initialPrompt, options);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to restart Claude PTY session', { sessionId, error: errorMessage });
          this.emit('error', sessionId, new Error(`Failed to restart Claude process: ${errorMessage}`));
        }
      }, 500);
    } else {
      logger.warn('Cannot restart Claude PTY session: session not found and no workingDir provided', { sessionId });
    }
  }

  /**
   * セッションが存在するか確認
   *
   * @param sessionId - セッションID
   * @returns セッションが存在する場合はtrue
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId) || this.dockerAdapter.hasSession(sessionId);
  }

  /**
   * セッションの作業ディレクトリを取得
   *
   * @param sessionId - セッションID
   * @returns 作業ディレクトリ、存在しない場合はundefined
   */
  getWorkingDir(sessionId: string): string | undefined {
    // Dockerセッションの場合はDockerPTYAdapterから取得
    const dockerWorkingDir = this.dockerAdapter.getWorkingDir(sessionId);
    if (dockerWorkingDir) {
      return dockerWorkingDir;
    }
    return this.sessions.get(sessionId)?.workingDir;
  }

  /**
   * Claude CodeセッションIDを取得
   *
   * @param sessionId - セッションID
   * @returns Claude CodeセッションID、存在しない場合はundefined
   */
  getClaudeSessionId(sessionId: string): string | undefined {
    // Dockerセッションの場合はDockerPTYAdapterから取得
    const dockerClaudeSessionId = this.dockerAdapter.getClaudeSessionId(sessionId);
    if (dockerClaudeSessionId) {
      return dockerClaudeSessionId;
    }
    return this.sessions.get(sessionId)?.claudeSessionId;
  }

  /**
   * Claude Code出力からセッションIDを抽出
   * 形式: "session: <id>" または "[session:<id>]"
   *
   * セッションIDは以下の形式をサポート:
   * - 36文字のUUID形式: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
   * - 短いアルファヌメリック形式: "abc123"
   *
   * @param data - PTY出力データ
   * @returns 抽出されたセッションID、見つからない場合はundefined
   */
  private extractClaudeSessionId(data: string): string | undefined {
    // Claude Codeのセッション出力パターン
    // 例: "session: abc123" または "[session:f47ac10b-58cc-4372-a567-0e02b2c3d479]"
    // UUIDまたは短いアルファヌメリックID（4文字以上）をサポート
    const sessionIdPattern = '([a-zA-Z0-9-]{4,36})';
    const patterns = [
      new RegExp(`session[:\\s]+${sessionIdPattern}`, 'i'),
      new RegExp(`\\[session:${sessionIdPattern}\\]`, 'i'),
      new RegExp(`Resuming session[:\\s]+${sessionIdPattern}`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }
}

/**
 * グローバルClaude PTYマネージャーインスタンス
 */
export const claudePtyManager = new ClaudePTYManager();
