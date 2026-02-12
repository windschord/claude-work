import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { PTYSessionManager, ptySessionManager } from './pty-session-manager';
import { db } from '@/lib/db';
import type { ClaudeCodeOptions, CustomEnvVars } from './claude-options-service';

/**
 * Claude PTYセッション作成オプション
 */
export interface CreateClaudePTYSessionOptions {
  resumeSessionId?: string; // Claude Codeの--resume用セッションID
  dockerMode?: boolean; // 非推奨: 後方互換性のため残す。environmentIdを使用すること。
  claudeCodeOptions?: ClaudeCodeOptions; // Claude Code CLIオプション
  customEnvVars?: CustomEnvVars; // カスタム環境変数
  environmentId?: string; // 実行環境ID
}

/**
 * PTYプロセス終了情報
 */
export interface ClaudePTYExitInfo {
  exitCode: number;
  signal?: number;
}

/**
 * ClaudePTYManager
 *
 * PTYSessionManagerへの薄いラッパー。
 * 後方互換性を維持しつつ、すべてのPTY操作をPTYSessionManagerに委譲する。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: ClaudePTYExitInfo)
 * - 'error': エラー発生 (sessionId: string, error: Error)
 * - 'claudeSessionId': Claude CodeセッションID抽出 (sessionId: string, claudeSessionId: string)
 *
 * @deprecated 将来的にはPTYSessionManagerを直接使用してください。
 */
class ClaudePTYManager extends EventEmitter {
  private ptySessionManager: PTYSessionManager;
  private creating: Set<string> = new Set();

  constructor() {
    super();
    this.ptySessionManager = ptySessionManager;

    // PTYSessionManagerのイベントを中継
    this.setupPTYSessionManagerEvents();
  }

  /**
   * PTYSessionManagerからのイベントを中継
   */
  private setupPTYSessionManagerEvents(): void {
    // dataイベント: PTY出力
    this.ptySessionManager.on('data', (sessionId: string, data: string) => {
      this.emit('data', sessionId, data);

      // セッションIDの抽出を試みる（後方互換性）
      const extractedId = this.extractClaudeSessionId(data);
      if (extractedId) {
        logger.info('Claude session ID extracted', {
          sessionId,
          claudeSessionId: extractedId,
        });
        this.emit('claudeSessionId', sessionId, extractedId);
      }
    });

    // exitイベント: PTY終了
    this.ptySessionManager.on('exit', (sessionId: string, exitCode: number) => {
      this.emit('exit', sessionId, { exitCode });
    });

    // errorイベント: エラー
    this.ptySessionManager.on('error', (sessionId: string, error: Error) => {
      this.emit('error', sessionId, error);
    });
  }

  /**
   * Claude Codeプロセスを作成
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ（worktreeパス）
   * @param initialPrompt - 初期プロンプト（任意）
   * @param options - 追加オプション（environmentId, resumeSessionIdなど）
   * @throws 同一sessionIdで作成中の場合、またはworkingDirが無効な場合
   */
  async createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateClaudePTYSessionOptions
  ): Promise<void> {
    // 作成中のセッションがある場合はエラー
    if (this.creating.has(sessionId)) {
      throw new Error(`Claude PTY creation already in progress for session ${sessionId}`);
    }

    // 既存のセッションがあれば再利用
    if (this.ptySessionManager.hasSession(sessionId)) {
      logger.info('Reusing existing PTY session', { sessionId });
      return;
    }

    // 作成中フラグを立てる
    this.creating.add(sessionId);

    try {
      // 環境IDの決定
      let environmentId = options?.environmentId;

      // environmentIdが未指定の場合、デフォルトHOST環境を使用
      if (!environmentId) {
        // dockerMode（非推奨）が指定されている場合は警告を出す
        if (options?.dockerMode) {
          logger.warn(
            'dockerMode option is deprecated. Please use environmentId instead.',
            { sessionId }
          );
        }

        // デフォルトHOST環境を取得
        const defaultEnv = await db.query.executionEnvironments.findFirst({
          where: (env, { eq }) => eq(env.type, 'HOST'),
        });

        if (!defaultEnv) {
          throw new Error('Default HOST environment not found');
        }

        environmentId = defaultEnv.id;
        logger.info('Using default HOST environment', { sessionId, environmentId });
      }

      // PTYSessionManagerに委譲
      await this.ptySessionManager.createSession({
        sessionId,
        projectId: 'default', // TODO: プロジェクトIDを引数から取得
        branchName: 'main', // TODO: ブランチ名を引数から取得
        worktreePath: workingDir,
        environmentId,
        cols: 80,
        rows: 24,
      });

      logger.info('Claude PTY session created via PTYSessionManager', { sessionId });

      // 初期プロンプトがあれば送信
      if (initialPrompt) {
        setTimeout(() => {
          if (this.ptySessionManager.hasSession(sessionId)) {
            this.ptySessionManager.sendInput(sessionId, initialPrompt + '\n');
            logger.info('Sent initial prompt to Claude Code', {
              sessionId,
              promptLength: initialPrompt.length,
            });
          } else {
            logger.warn('Session no longer exists, skipping initial prompt', { sessionId });
          }
        }, 3000); // Claude Codeの起動を待つ（3秒）
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create Claude PTY session', { sessionId, error: errorMessage });
      this.emit('error', sessionId, new Error(`Failed to create PTY session: ${errorMessage}`));
      throw error;
    } finally {
      // 作成完了フラグをクリア
      this.creating.delete(sessionId);
    }
  }

  /**
   * PTYに入力を送信
   *
   * @param sessionId - セッションID
   * @param data - 入力データ
   */
  write(sessionId: string, data: string): void {
    try {
      this.ptySessionManager.sendInput(sessionId, data);
    } catch (error) {
      logger.warn(`Failed to write to session ${sessionId}:`, error);
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
    try {
      this.ptySessionManager.resize(sessionId, cols, rows);
    } catch (error) {
      logger.warn(`Failed to resize session ${sessionId}:`, error);
    }
  }

  /**
   * セッションを終了
   *
   * @param sessionId - セッションID
   */
  async destroySession(sessionId: string): Promise<void> {
    logger.info('Destroying Claude PTY session via PTYSessionManager', { sessionId });
    try {
      await this.ptySessionManager.destroySession(sessionId);
    } catch (error) {
      logger.error(`Failed to destroy session ${sessionId}:`, error);
    }
  }

  /**
   * セッションを再起動
   *
   * @param sessionId - セッションID
   * @param workingDir - フォールバック用作業ディレクトリ
   * @param initialPrompt - フォールバック用初期プロンプト
   * @param options - フォールバック用オプション
   */
  async restartSession(
    sessionId: string,
    workingDir?: string,
    initialPrompt?: string,
    options?: CreateClaudePTYSessionOptions
  ): Promise<void> {
    // セッション情報を取得
    const session = this.ptySessionManager.getSession(sessionId);

    if (session) {
      const { worktreePath, environmentId } = session.metadata;
      logger.info('Restarting Claude PTY session', { sessionId, environmentId });

      // セッションを破棄
      await this.destroySession(sessionId);

      // 少し待ってから再作成
      setTimeout(async () => {
        try {
          await this.createSession(sessionId, worktreePath, initialPrompt, {
            environmentId,
            ...options,
          });
        } catch (error) {
          logger.error('Failed to restart session', { sessionId, error });
        }
      }, 500);
    } else if (workingDir) {
      // セッションがメモリにない場合、引数のworkingDirで再作成
      logger.info('Restarting Claude PTY session (from fallback params)', { sessionId });

      setTimeout(async () => {
        try {
          await this.createSession(sessionId, workingDir, initialPrompt, options);
        } catch (error) {
          logger.error('Failed to restart session', { sessionId, error });
        }
      }, 500);
    } else {
      logger.warn(
        'Cannot restart Claude PTY session: session not found and no workingDir provided',
        { sessionId }
      );
    }
  }

  /**
   * セッションが存在するか確認
   *
   * @param sessionId - セッションID
   * @returns セッションが存在する場合はtrue
   */
  hasSession(sessionId: string): boolean {
    return this.ptySessionManager.hasSession(sessionId);
  }

  /**
   * セッションの作業ディレクトリを取得
   *
   * @param sessionId - セッションID
   * @returns 作業ディレクトリ、存在しない場合はundefined
   */
  getWorkingDir(sessionId: string): string | undefined {
    const session = this.ptySessionManager.getSession(sessionId);
    return session?.metadata.worktreePath;
  }

  /**
   * セッションのスクロールバックバッファを取得
   *
   * @param _sessionId - セッションID（未使用、後方互換性のため残す）
   * @returns バッファ内容、存在しない場合はnull
   * @deprecated PTYSessionManagerのConnectionManager経由でアクセスしてください
   */
  getScrollbackBuffer(_sessionId: string): string | null {
    logger.warn('getScrollbackBuffer is deprecated. Use ConnectionManager instead.');
    // 後方互換性のため、ConnectionManager経由で取得を試みる
    // ただし、ClaudePTYManager経由では取得不可（ConnectionManagerはPTYSessionManagerの内部）
    return null;
  }

  /**
   * Claude CodeセッションIDを取得
   *
   * @param _sessionId - セッションID（未使用、後方互換性のため残す）
   * @returns Claude CodeセッションID、存在しない場合はundefined
   * @deprecated データベースから直接取得してください
   */
  getClaudeSessionId(_sessionId: string): string | undefined {
    logger.warn('getClaudeSessionId is deprecated. Fetch from database instead.');
    // 後方互換性のため、undefinedを返す
    // 実際の値はデータベースのsessions.resume_session_idに保存される
    return undefined;
  }

  /**
   * Claude Code出力からセッションIDを抽出
   * 形式: "session: <id>" または "[session:<id>]"
   *
   * @param data - PTY出力データ
   * @returns 抽出されたセッションID、見つからない場合はundefined
   */
  private extractClaudeSessionId(data: string): string | undefined {
    // Claude Codeのセッション出力パターン
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
