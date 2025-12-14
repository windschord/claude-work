import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PTYセッション情報
 */
interface PTYSession {
  ptyProcess: pty.IPty;
  sessionId: string;
  workingDir: string;
}

/**
 * PTYプロセス終了情報
 */
export interface PTYExitInfo {
  /** 終了コード */
  exitCode: number;
  /** シグナル番号（シグナルで終了した場合） */
  signal?: number;
}

/**
 * PTY用の安全な環境変数を構築
 */
function buildPtyEnv(): Record<string, string> {
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
  ]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue; // undefined/empty を除外
    if (!allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}


/**
 * PTYManager
 *
 * PTY（Pseudo-Terminal）プロセスを管理するサービス。
 * セッションごとにPTYプロセスを生成し、入出力を中継する。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: PTYExitInfo)
 */
class PTYManager extends EventEmitter {
  private sessions: Map<string, PTYSession> = new Map();
  private creating: Set<string> = new Set();

  /**
   * PTYプロセスを作成
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ（worktreeパス）
   */
  createPTY(sessionId: string, workingDir: string): void {
    // 作成中のセッションがある場合はエラー
    if (this.creating.has(sessionId)) {
      throw new Error(`PTY creation already in progress for session ${sessionId}`);
    }

    // 既存のセッションがあればクリーンアップ
    if (this.sessions.has(sessionId)) {
      this.kill(sessionId);
    }

    // 作成中フラグを立てる
    this.creating.add(sessionId);

    // workingDirの検証
    const resolvedCwd = path.resolve(workingDir);
    const resolvedRoot = path.resolve(process.cwd());
    if (!resolvedCwd.startsWith(resolvedRoot + path.sep) && resolvedCwd !== resolvedRoot) {
      this.creating.delete(sessionId);
      throw new Error(`workingDir is outside allowed root: ${resolvedCwd}`);
    }
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

    // プラットフォームに応じたシェルを選択
    // 環境変数SHELLが利用可能ならそれを使用、そうでなければプラットフォームのデフォルトを使用
    let shell: string;
    if (os.platform() === 'win32') {
      shell = 'powershell.exe';
    } else {
      // Unix系システムでは環境変数SHELLを優先、なければmacOSはzsh、それ以外はbashをデフォルトに
      const envShell = buildPtyEnv().SHELL;
      if (envShell) {
        shell = envShell;
      } else if (os.platform() === 'darwin') {
        // macOS Catalina (10.15) 以降はzshがデフォルト
        shell = '/bin/zsh';
      } else {
        shell = '/bin/bash';
      }
    }

    try {
      // PTYプロセスを生成
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: resolvedCwd,
        env: buildPtyEnv(),
      });

      // セッションを登録
      this.sessions.set(sessionId, { ptyProcess, sessionId, workingDir: resolvedCwd });
      // 作成完了フラグをクリア
      this.creating.delete(sessionId);

      // PTY出力をイベントとして発火
      ptyProcess.onData((data: string) => {
        this.emit('data', sessionId, data);
      });

      // PTY終了時の処理
      ptyProcess.onExit(({ exitCode, signal }) => {
        this.emit('exit', sessionId, { exitCode, signal });
        this.sessions.delete(sessionId);
      });
    } catch (error) {
      // エラー時も作成中フラグをクリア
      this.creating.delete(sessionId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', sessionId, {
        message: `Failed to spawn PTY process: ${errorMessage}`,
        shell,
        workingDir: resolvedCwd,
      });
      throw new Error(
        `Failed to spawn PTY process for session ${sessionId}: ${errorMessage} (shell: ${shell}, cwd: ${resolvedCwd})`
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
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * PTYプロセスを終了
   *
   * @param sessionId - セッションID
   */
  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * セッションが存在するか確認
   *
   * @param sessionId - セッションID
   * @returns セッションが存在する場合はtrue
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

/**
 * グローバルPTYマネージャーインスタンス
 */
export const ptyManager = new PTYManager();
