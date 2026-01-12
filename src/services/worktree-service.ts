/**
 * WorktreeService
 * Git Worktreeの作成・削除を管理するサービス
 */

import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Worktree作成オプション
 */
export interface WorktreeCreateOptions {
  repoPath: string; // 親リポジトリのパス
  worktreePath: string; // Worktreeの配置先
  branch: string; // 新しいブランチ名
  parentBranch: string; // 親ブランチ名
}

/**
 * Worktree削除オプション
 */
export interface WorktreeRemoveOptions {
  force?: boolean; // 強制削除
}

/**
 * Worktree情報
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
}

/**
 * コマンド実行関数の型
 */
export type ExecFunction = (
  command: string,
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

/**
 * ディレクトリ作成関数の型
 */
export type MkdirFunction = (
  path: string,
  options: { recursive: boolean }
) => Promise<void>;

/**
 * ディレクトリ削除関数の型
 */
export type RmFunction = (
  path: string,
  options: { recursive: boolean; force: boolean }
) => Promise<void>;

/**
 * ファイル存在確認関数の型
 */
export type ExistsFunction = (path: string) => Promise<boolean>;

/**
 * WorktreeServiceの設定
 */
export interface WorktreeServiceOptions {
  homedir?: string;
  execFn?: ExecFunction;
  mkdirFn?: MkdirFunction;
  rmFn?: RmFunction;
  existsFn?: ExistsFunction;
}

/**
 * デフォルトのexists関数
 */
async function defaultExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * デフォルトのmkdir関数
 */
async function defaultMkdir(
  targetPath: string,
  options: { recursive: boolean }
): Promise<void> {
  await fs.mkdir(targetPath, options);
}

/**
 * デフォルトのrm関数
 */
async function defaultRm(
  targetPath: string,
  options: { recursive: boolean; force: boolean }
): Promise<void> {
  await fs.rm(targetPath, options);
}

/**
 * WorktreeService
 * Git Worktreeの作成・削除を管理
 */
export class WorktreeService {
  private readonly homedir: string;
  private readonly execFn: ExecFunction;
  private readonly mkdirFn?: MkdirFunction;
  private readonly rmFn?: RmFunction;
  private readonly existsFn?: ExistsFunction;

  constructor(options?: WorktreeServiceOptions) {
    this.homedir = options?.homedir ?? os.homedir();
    this.execFn = options?.execFn ?? execAsync;
    this.mkdirFn = options?.mkdirFn ?? defaultMkdir;
    this.rmFn = options?.rmFn ?? defaultRm;
    this.existsFn = options?.existsFn ?? defaultExists;
  }

  /**
   * Worktreeディレクトリのベースパスを取得
   */
  static getWorktreeBaseDir(homedir?: string): string {
    const home = homedir ?? os.homedir();
    return path.join(home, '.claudework', 'worktrees');
  }

  /**
   * Worktreeパスを生成
   */
  static generateWorktreePath(
    repoName: string,
    sessionName: string,
    homedir?: string
  ): string {
    const baseDir = WorktreeService.getWorktreeBaseDir(homedir);
    return path.join(baseDir, `${repoName}-${sessionName}`);
  }

  /**
   * ブランチ名を生成（session/<name>形式、スペース等はハイフンに変換）
   */
  static generateBranchName(sessionName: string): string {
    const normalized = sessionName
      .trim()
      .replace(/\s+/g, '-');
    return `session/${normalized}`;
  }

  /**
   * Worktreeを作成
   */
  async create(options: WorktreeCreateOptions): Promise<void> {
    const { repoPath, worktreePath, branch, parentBranch } = options;

    // ベースディレクトリを作成
    if (this.mkdirFn) {
      const baseDir = path.dirname(worktreePath);
      await this.mkdirFn(baseDir, { recursive: true });
    }

    // git worktree add -b <branch> <worktreePath> <parentBranch>
    const command = `git worktree add -b ${branch} ${worktreePath} ${parentBranch}`;
    await this.execFn(command, { cwd: repoPath });
  }

  /**
   * Worktreeを削除
   */
  async remove(
    worktreePath: string,
    repoPath: string,
    options?: WorktreeRemoveOptions
  ): Promise<void> {
    // git worktree remove <worktreePath>
    const forceFlag = options?.force ? '--force ' : '';
    const command = `git worktree remove ${forceFlag}${worktreePath}`;
    await this.execFn(command, { cwd: repoPath });

    // ディレクトリが残っていれば削除
    if (this.existsFn && this.rmFn) {
      const exists = await this.existsFn(worktreePath);
      if (exists) {
        await this.rmFn(worktreePath, { recursive: true, force: true });
      }
    }
  }

  /**
   * Worktree一覧を取得
   */
  async list(repoPath: string): Promise<WorktreeInfo[]> {
    const { stdout } = await this.execFn('git worktree list --porcelain', {
      cwd: repoPath,
    });

    if (!stdout.trim()) {
      return [];
    }

    return this.parseWorktreeListOutput(stdout);
  }

  /**
   * git worktree list --porcelain の出力をパース
   */
  private parseWorktreeListOutput(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const blocks = output.split('\n\n').filter((block) => block.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      let worktreePath = '';
      let branch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktreePath = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
          // refs/heads/xxx から xxx を抽出
          const fullBranch = line.substring('branch '.length);
          branch = fullBranch.replace(/^refs\/heads\//, '');
        }
        // detached の場合は branch が空のまま
      }

      if (worktreePath) {
        worktrees.push({ path: worktreePath, branch });
      }
    }

    return worktrees;
  }
}
