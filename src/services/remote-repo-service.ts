import { spawn, spawnSync } from 'child_process';
import { join, basename, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../lib/logger';
import { getReposDir } from '@/lib/data-dir';
import type { AdapterFactory } from './adapter-factory';

/**
 * Clone操作のオプション
 */
export interface CloneOptions {
  /** リモートリポジトリURL（SSH/HTTPS） */
  url: string;
  /** clone先の完全なパス（指定時はbaseDirは無視） */
  targetDir?: string;
  /** clone先のベースディレクトリ（targetDirが未指定時に使用） */
  baseDir?: string;
  /** プロジェクト名（省略時はURLから自動抽出） */
  name?: string;
  /** 実行環境ID（指定時はDockerAdapter経由で実行） */
  environmentId?: string;
}

/**
 * Clone操作の結果
 */
export interface CloneResult {
  success: boolean;
  /** cloneしたローカルパス */
  path: string;
  /** エラーメッセージ（失敗時） */
  error?: string;
}

/**
 * Pull操作の結果
 */
export interface PullResult {
  success: boolean;
  /** 更新があったかどうか */
  updated: boolean;
  /** 結果メッセージ */
  message: string;
  /** エラーメッセージ（失敗時） */
  error?: string;
}

/**
 * ブランチ情報
 */
export interface Branch {
  /** ブランチ名 */
  name: string;
  /** デフォルトブランチかどうか */
  isDefault: boolean;
  /** リモートブランチかどうか */
  isRemote: boolean;
}

/**
 * リモートリポジトリ操作を管理するサービスクラス
 *
 * このクラスは、リモートGitリポジトリのclone、pull、ブランチ取得などの
 * 操作を提供します。SSH認証はシステムの設定を利用します。
 */
export class RemoteRepoService {
  constructor(private adapterFactory?: AdapterFactory) {}
  // Git SSH URL パターン: git@host:path/to/repo.git
  private static readonly SSH_URL_PATTERN = /^git@[\w.-]+:[\w./-]+$/;
  // Git HTTPS URL パターン: https://host/path/to/repo.git
  private static readonly HTTPS_URL_PATTERN = /^https:\/\/[\w.-]+(:\d+)?\/[\w./-]+$/;

  /**
   * リモートURLを検証
   *
   * SSH URL (git@...) または HTTPS URL (https://...) のみを許可します。
   * HTTP (非HTTPS) や file:// URLs は拒否されます。
   * テスト用にローカルリポジトリパスも許可されます（.gitディレクトリが存在する場合）。
   *
   * @param url - 検証するURL
   * @returns 検証結果
   */
  validateRemoteUrl(url: string): { valid: boolean; error?: string } {
    if (!url || url.trim() === '') {
      return { valid: false, error: 'URLが空です' };
    }

    const trimmedUrl = url.trim();

    // file:// URLs を拒否
    if (trimmedUrl.startsWith('file://')) {
      return { valid: false, error: 'file:// URLはサポートされていません' };
    }

    // HTTP (非HTTPS) を拒否
    if (trimmedUrl.startsWith('http://')) {
      return { valid: false, error: 'HTTP URLはサポートされていません。HTTPSを使用してください' };
    }

    // SSH URL チェック
    if (trimmedUrl.startsWith('git@')) {
      // .gitサフィックスを除去してからチェック
      const urlWithoutGit = trimmedUrl.replace(/\.git$/, '');
      if (RemoteRepoService.SSH_URL_PATTERN.test(urlWithoutGit)) {
        return { valid: true };
      }
      return { valid: false, error: '無効なSSH URLフォーマットです' };
    }

    // HTTPS URL チェック
    if (trimmedUrl.startsWith('https://')) {
      // .gitサフィックスを除去してからチェック
      const urlWithoutGit = trimmedUrl.replace(/\.git$/, '');
      if (RemoteRepoService.HTTPS_URL_PATTERN.test(urlWithoutGit)) {
        return { valid: true };
      }
      return { valid: false, error: '無効なHTTPS URLフォーマットです' };
    }

    // ローカルリポジトリパスのチェック（テスト・開発用）
    // 絶対パスで.gitディレクトリが存在する場合は許可
    if (trimmedUrl.startsWith('/') && existsSync(join(trimmedUrl, '.git'))) {
      return { valid: true };
    }

    return { valid: false, error: '有効なGitリポジトリURLを入力してください（SSH: git@... または HTTPS: https://...）' };
  }

  /**
   * URLからリポジトリ名を抽出
   *
   * @param url - Git URL
   * @returns リポジトリ名
   */
  extractRepoName(url: string): string {
    // 末尾のスラッシュを除去
    let cleaned = url.replace(/\/+$/, '');
    // .git サフィックスを除去
    cleaned = cleaned.replace(/\.git$/, '');

    // SSH URL: git@host:path/to/repo
    if (cleaned.includes(':') && cleaned.startsWith('git@')) {
      const pathPart = cleaned.split(':')[1];
      return basename(pathPart);
    }

    // HTTPS URL: https://host/path/to/repo
    return basename(cleaned);
  }

  /**
   * リモートリポジトリをclone
   *
   * @param options - cloneオプション
   * @returns clone結果
   */
  async clone(options: CloneOptions): Promise<CloneResult> {
    const { url, targetDir, baseDir, name, environmentId } = options;

    // URL検証
    const validation = this.validateRemoteUrl(url);
    if (!validation.valid) {
      return { success: false, path: '', error: validation.error };
    }

    // environmentIdが指定されている場合はDockerAdapter経由で実行
    if (environmentId && this.adapterFactory) {
      try {
        const adapter = await this.adapterFactory.getAdapter(environmentId);

        // clone先パスを決定
        let clonePath: string;
        if (targetDir) {
          clonePath = resolve(targetDir);
        } else {
          const repoName = name || this.extractRepoName(url);
          const base = baseDir || getReposDir();
          if (!existsSync(base)) {
            mkdirSync(base, { recursive: true });
          }
          clonePath = this.getUniqueClonePath(base, repoName);
        }

        // 既にディレクトリが存在する場合はエラー（targetDir指定時のみ）
        if (targetDir && existsSync(clonePath)) {
          return { success: false, path: clonePath, error: `ディレクトリ ${clonePath} は既に存在します` };
        }

        const result = await adapter.gitClone({
          url,
          targetPath: clonePath,
          environmentId,
        });

        if (result.success) {
          logger.info('Repository cloned successfully via DockerAdapter', { url, clonePath });
          return { success: true, path: clonePath };
        } else {
          return { success: false, path: clonePath, error: result.error };
        }
      } catch (error) {
        return {
          success: false,
          path: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // clone先パスを決定
    let clonePath: string;
    if (targetDir) {
      clonePath = resolve(targetDir);
    } else {
      const repoName = name || this.extractRepoName(url);
      const base = baseDir || getReposDir();

      // ベースディレクトリが存在しない場合は作成
      if (!existsSync(base)) {
        mkdirSync(base, { recursive: true });
      }

      clonePath = this.getUniqueClonePath(base, repoName);
    }

    // 既にディレクトリが存在する場合はエラー（targetDir指定時のみ）
    if (targetDir && existsSync(clonePath)) {
      return { success: false, path: clonePath, error: `ディレクトリ ${clonePath} は既に存在します` };
    }

    // git clone を実行
    return new Promise((resolve) => {
      const cloneProcess = spawn('git', ['clone', url, clonePath], {
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // インタラクティブプロンプトを抑止
        },
      });

      let stderr = '';

      cloneProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      cloneProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Repository cloned successfully', { url, clonePath });
          resolve({ success: true, path: clonePath });
        } else {
          logger.error('Failed to clone repository', { url, clonePath, stderr });
          resolve({ success: false, path: clonePath, error: stderr || 'cloneに失敗しました' });
        }
      });

      cloneProcess.on('error', (err) => {
        logger.error('Clone process error', { url, error: err.message });
        resolve({ success: false, path: clonePath, error: err.message });
      });
    });
  }

  /**
   * 重複しないcloneパスを取得
   *
   * @param baseDir - ベースディレクトリ
   * @param repoName - リポジトリ名
   * @returns 重複しないパス
   */
  private getUniqueClonePath(baseDir: string, repoName: string): string {
    let clonePath = join(baseDir, repoName);

    if (!existsSync(clonePath)) {
      return clonePath;
    }

    // 重複する場合はサフィックスを追加
    let counter = 1;
    while (existsSync(clonePath)) {
      clonePath = join(baseDir, `${repoName}-${counter}`);
      counter++;
    }

    return clonePath;
  }

  /**
   * リポジトリを更新（pull）
   *
   * fast-forward onlyでpullを実行します。
   * ローカルに競合する変更がある場合は失敗します。
   *
   * @param repoPath - リポジトリのローカルパス
   * @param environmentId - 実行環境ID（指定時はDockerAdapter経由で実行）
   * @returns pull結果
   */
  async pull(repoPath: string, environmentId?: string): Promise<PullResult> {
    // environmentIdが指定されている場合はDockerAdapter経由で実行
    if (environmentId && this.adapterFactory) {
      try {
        const adapter = await this.adapterFactory.getAdapter(environmentId);
        return await adapter.gitPull(repoPath);
      } catch (error) {
        return {
          success: false,
          updated: false,
          message: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    // Gitリポジトリかどうか確認
    const isGitRepo = this.isGitRepository(repoPath);
    if (!isGitRepo) {
      return {
        success: false,
        updated: false,
        message: '',
        error: `${repoPath} はGitリポジトリではありません`,
      };
    }

    return new Promise((resolve) => {
      // fetch first
      const fetchProcess = spawn('git', ['fetch'], {
        cwd: repoPath,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      fetchProcess.on('close', (fetchCode) => {
        if (fetchCode !== 0) {
          resolve({
            success: false,
            updated: false,
            message: '',
            error: 'fetchに失敗しました',
          });
          return;
        }

        // pull with fast-forward only
        const pullProcess = spawn('git', ['pull', '--ff-only'], {
          cwd: repoPath,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        });

        let stdout = '';
        let stderr = '';

        pullProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pullProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pullProcess.on('close', (code) => {
          if (code === 0) {
            const updated = !stdout.includes('Already up to date');
            logger.info('Repository pulled successfully', { repoPath, updated });
            resolve({
              success: true,
              updated,
              message: updated ? '更新しました' : '既に最新です',
            });
          } else {
            logger.error('Failed to pull repository', { repoPath, stderr });
            resolve({
              success: false,
              updated: false,
              message: '',
              error: stderr || 'pullに失敗しました。ローカルに競合する変更がある可能性があります',
            });
          }
        });

        pullProcess.on('error', (err) => {
          resolve({
            success: false,
            updated: false,
            message: '',
            error: err.message,
          });
        });
      });

      fetchProcess.on('error', (err) => {
        resolve({
          success: false,
          updated: false,
          message: '',
          error: err.message,
        });
      });
    });
  }

  /**
   * ブランチ一覧を取得
   *
   * ローカルブランチとリモート追跡ブランチの両方を返します。
   *
   * @param repoPath - リポジトリのローカルパス
   * @param environmentId - 実行環境ID（指定時はDockerAdapter経由で実行）
   * @returns ブランチ一覧
   */
  async getBranches(repoPath: string, environmentId?: string): Promise<Branch[]> {
    // environmentIdが指定されている場合はDockerAdapter経由で実行
    if (environmentId && this.adapterFactory) {
      try {
        const adapter = await this.adapterFactory.getAdapter(environmentId);
        return await adapter.gitGetBranches(repoPath);
      } catch (error) {
        logger.error('Failed to get branches via DockerAdapter', { repoPath, error });
        return [];
      }
    }
    if (!this.isGitRepository(repoPath)) {
      return [];
    }

    const branches: Branch[] = [];

    // デフォルトブランチを取得
    const defaultBranch = await this.getDefaultBranch(repoPath);

    // ローカルブランチを取得
    const localResult = spawnSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    if (localResult.status === 0 && localResult.stdout) {
      const localBranches = localResult.stdout
        .split('\n')
        .filter((name) => name.trim() !== '');

      for (const name of localBranches) {
        branches.push({
          name,
          isDefault: name === defaultBranch,
          isRemote: false,
        });
      }
    }

    // リモートブランチを取得
    const remoteResult = spawnSync('git', ['branch', '-r', '--format=%(refname:short)'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    if (remoteResult.status === 0 && remoteResult.stdout) {
      const remoteBranches = remoteResult.stdout
        .split('\n')
        .filter((name) => name.trim() !== '' && !name.includes('HEAD'));

      for (const name of remoteBranches) {
        // 既にローカルにある場合はスキップ
        const localName = name.replace(/^origin\//, '');
        if (!branches.some((b) => b.name === localName && !b.isRemote)) {
          branches.push({
            name,
            isDefault: false,
            isRemote: true,
          });
        }
      }
    }

    return branches;
  }

  /**
   * デフォルトブランチを取得
   *
   * @param repoPath - リポジトリのローカルパス
   * @returns デフォルトブランチ名
   */
  async getDefaultBranch(repoPath: string): Promise<string> {
    // origin/HEAD からデフォルトブランチを取得
    const result = spawnSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    if (result.status === 0 && result.stdout) {
      // refs/remotes/origin/main -> main
      const ref = result.stdout.trim();
      return ref.replace('refs/remotes/origin/', '');
    }

    // フォールバック: 現在のブランチを確認
    const currentResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    if (currentResult.status === 0 && currentResult.stdout) {
      return currentResult.stdout.trim();
    }

    // デフォルトは main
    return 'main';
  }

  /**
   * Gitリポジトリかどうかを確認
   *
   * @param path - 確認するパス
   * @returns Gitリポジトリの場合true
   */
  private isGitRepository(path: string): boolean {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd: path,
      encoding: 'utf-8',
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    return result.status === 0;
  }
}

// シングルトンインスタンス
export const remoteRepoService = new RemoteRepoService();
