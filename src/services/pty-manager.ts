import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as os from 'os';

/**
 * PTYセッション情報
 */
interface PTYSession {
  ptyProcess: pty.IPty;
  sessionId: string;
  workingDir: string;
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

  /**
   * PTYプロセスを作成
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ（worktreeパス）
   */
  createPTY(sessionId: string, workingDir: string): void {
    // プラットフォームに応じたシェルを選択
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

    // PTYプロセスを生成
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env as { [key: string]: string },
    });

    // セッションを登録
    this.sessions.set(sessionId, { ptyProcess, sessionId, workingDir });

    // PTY出力をイベントとして発火
    ptyProcess.onData((data: string) => {
      this.emit('data', sessionId, data);
    });

    // PTY終了時の処理
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', sessionId, { exitCode, signal });
      this.sessions.delete(sessionId);
    });
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
