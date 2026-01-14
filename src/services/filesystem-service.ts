/**
 * FilesystemService
 * ローカルファイルシステムへのアクセスを提供するサービス
 * タスク1.1: ディレクトリ一覧取得、Gitリポジトリ判定、パス検証
 * タスク1.2: ブランチ取得機能
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * アクセス拒否エラー
 */
export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

/**
 * 見つからないエラー
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * ディレクトリエントリ
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isGitRepository: boolean;
  isHidden: boolean;
}

/**
 * パスの最大長
 */
const MAX_PATH_LENGTH = 4096;

/**
 * コマンド実行関数の型
 */
export type ExecFunction = (
  command: string,
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

/**
 * FilesystemServiceの設定
 */
export interface FilesystemServiceOptions {
  homedir?: string;
  execFn?: ExecFunction;
}

/**
 * FilesystemService
 * ローカルファイルシステムへのセキュアなアクセスを提供
 */
export class FilesystemService {
  private readonly homedir: string;
  private readonly execFn: ExecFunction;

  constructor(options?: FilesystemServiceOptions) {
    this.homedir = options?.homedir ?? os.homedir();
    this.execFn = options?.execFn ?? execAsync;
  }

  /**
   * パスがアクセス可能かどうかを検証
   * ホームディレクトリ内のみアクセス可能
   */
  isPathAllowed(targetPath: string): boolean {
    const resolvedPath = path.resolve(targetPath);
    return resolvedPath.startsWith(this.homedir);
  }

  /**
   * パスのバリデーション
   * セキュリティチェックを実施
   */
  validatePath(targetPath: string): void {
    // null バイトのチェック
    if (targetPath.includes('\0')) {
      throw new Error('Invalid path: null byte detected');
    }

    // パス長のチェック
    if (targetPath.length > MAX_PATH_LENGTH) {
      throw new Error(`Invalid path: path too long (max ${MAX_PATH_LENGTH} characters)`);
    }
  }

  /**
   * ディレクトリ内容を一覧取得
   */
  async listDirectory(targetPath?: string): Promise<DirectoryEntry[]> {
    const dirPath = targetPath || this.homedir;
    const resolvedPath = path.resolve(dirPath);

    // パスのバリデーション
    this.validatePath(resolvedPath);

    // アクセス権のチェック
    if (!this.isPathAllowed(resolvedPath)) {
      throw new AccessDeniedError('Access denied: path outside home directory');
    }

    // ディレクトリの存在確認
    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        throw new NotFoundError('Path is not a directory');
      }
    } catch (error: unknown) {
      if (error instanceof AccessDeniedError || error instanceof NotFoundError) {
        throw error;
      }
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        throw new NotFoundError(`Directory not found: ${resolvedPath}`);
      }
      throw error;
    }

    // ディレクトリ内容の取得
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const result: DirectoryEntry[] = [];

    for (const entry of entries) {
      const entryPath = path.join(resolvedPath, entry.name);
      const isDirectory = entry.isDirectory();
      const isHidden = entry.name.startsWith('.');

      let isGitRepository = false;
      if (isDirectory) {
        try {
          await fs.access(path.join(entryPath, '.git'));
          isGitRepository = true;
        } catch {
          // .git が存在しない場合は false
        }
      }

      result.push({
        name: entry.name,
        path: entryPath,
        type: isDirectory ? 'directory' : 'file',
        isGitRepository,
        isHidden,
      });
    }

    return result;
  }

  /**
   * パスがGitリポジトリかどうかを判定
   */
  async isGitRepository(targetPath: string): Promise<boolean> {
    const resolvedPath = path.resolve(targetPath);

    // アクセス権のチェック
    if (!this.isPathAllowed(resolvedPath)) {
      throw new AccessDeniedError('Access denied: path outside home directory');
    }

    try {
      await fs.access(path.join(resolvedPath, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 親ディレクトリのパスを取得
   * ホームディレクトリの場合は null を返す
   */
  getParentPath(targetPath: string): string | null {
    const resolvedPath = path.resolve(targetPath);

    // ホームディレクトリの場合は null
    if (resolvedPath === this.homedir) {
      return null;
    }

    const parentPath = path.dirname(resolvedPath);

    // 親がホームディレクトリ外の場合は null
    if (!this.isPathAllowed(parentPath)) {
      return null;
    }

    return parentPath;
  }

  /**
   * Gitリポジトリのブランチ一覧を取得
   */
  async getGitBranches(targetPath: string): Promise<string[]> {
    const resolvedPath = path.resolve(targetPath);

    // アクセス権のチェック
    if (!this.isPathAllowed(resolvedPath)) {
      throw new AccessDeniedError('Access denied: path outside home directory');
    }

    // Gitリポジトリかどうかを確認
    const isGitRepo = await this.isGitRepository(resolvedPath);
    if (!isGitRepo) {
      throw new Error('Not a git repository');
    }

    // git branch --list を実行
    const { stdout } = await this.execFn('git branch --list', { cwd: resolvedPath });

    // 出力をパースしてブランチ名の配列を返す
    const branches = stdout
      .split('\n')
      .map(line => line.replace(/^\*?\s*/, '').trim())
      .filter(line => line.length > 0);

    return branches;
  }

  /**
   * 現在のブランチ名を取得
   */
  async getCurrentBranch(targetPath: string): Promise<string> {
    const resolvedPath = path.resolve(targetPath);

    // アクセス権のチェック
    if (!this.isPathAllowed(resolvedPath)) {
      throw new AccessDeniedError('Access denied: path outside home directory');
    }

    // Gitリポジトリかどうかを確認
    const isGitRepo = await this.isGitRepository(resolvedPath);
    if (!isGitRepo) {
      throw new Error('Not a git repository');
    }

    // git symbolic-ref --short HEAD を実行（空のリポジトリでも動作する）
    // git rev-parse --abbrev-ref HEAD はコミットがないと失敗するため
    try {
      const { stdout } = await this.execFn('git symbolic-ref --short HEAD', { cwd: resolvedPath });
      return stdout.trim();
    } catch {
      // symbolic-refも失敗した場合は、.git/HEADファイルから直接読み取る
      // または "main" をデフォルトとして返す
      return 'main';
    }
  }
}
