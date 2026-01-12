/**
 * RepositoryManager
 * リポジトリの登録・管理を行うサービス
 */

import { prisma } from '@/lib/db';
import { Repository } from '@prisma/client';
import { logger } from '@/lib/logger';
import { FilesystemService } from './filesystem-service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * リポジトリが見つからないエラー
 */
export class RepositoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Repository not found: ${id}`);
    this.name = 'RepositoryNotFoundError';
  }
}

/**
 * リポジトリに関連セッションが存在するエラー
 */
export class RepositoryHasSessionsError extends Error {
  constructor(sessionCount: number) {
    super(`Cannot delete repository with ${sessionCount} active sessions`);
    this.name = 'RepositoryHasSessionsError';
  }
}

/**
 * リポジトリ登録オプション
 */
export interface RegisterRepositoryOptions {
  name: string;
  type: 'local' | 'remote';
  path?: string;   // local時
  url?: string;    // remote時
}

/**
 * ブランチ情報
 */
export interface BranchInfo {
  branches: string[];
  defaultBranch: string;
}

/**
 * セッション数を含むリポジトリ
 */
export type RepositoryWithSessionCount = Repository & { sessionCount: number };

/**
 * コマンド実行関数の型
 */
export type ExecFunction = (command: string) => Promise<{ stdout: string; stderr: string }>;

/**
 * RepositoryManagerの設定
 */
export interface RepositoryManagerOptions {
  execFn?: ExecFunction;
}

/**
 * RepositoryManager
 * リポジトリの登録・管理を行うサービス
 */
export class RepositoryManager {
  private readonly execFn: ExecFunction;
  private readonly filesystemService: FilesystemService;

  constructor(options?: RepositoryManagerOptions) {
    this.execFn = options?.execFn ?? execAsync;
    this.filesystemService = new FilesystemService();
  }

  /**
   * リポジトリを登録
   */
  async register(options: RegisterRepositoryOptions): Promise<Repository> {
    logger.info('Registering repository', { name: options.name, type: options.type });

    if (options.type === 'local') {
      return this.registerLocalRepository(options);
    } else {
      return this.registerRemoteRepository(options);
    }
  }

  /**
   * ローカルリポジトリを登録
   */
  private async registerLocalRepository(options: RegisterRepositoryOptions): Promise<Repository> {
    if (!options.path) {
      throw new Error('Path is required for local repository');
    }

    // Gitリポジトリかどうかを確認
    const isGitRepo = await this.filesystemService.isGitRepository(options.path);
    if (!isGitRepo) {
      throw new Error('Path is not a git repository');
    }

    // 現在のブランチをデフォルトブランチとして取得
    const defaultBranch = await this.filesystemService.getCurrentBranch(options.path);

    const repository = await prisma.repository.create({
      data: {
        name: options.name,
        type: 'local',
        path: options.path,
        url: null,
        defaultBranch,
      },
    });

    logger.info('Local repository registered', { id: repository.id, name: repository.name });
    return repository;
  }

  /**
   * リモートリポジトリを登録
   */
  private async registerRemoteRepository(options: RegisterRepositoryOptions): Promise<Repository> {
    if (!options.url) {
      throw new Error('URL is required for remote repository');
    }

    // デフォルトブランチを取得
    const defaultBranch = await this.getRemoteDefaultBranch(options.url);

    const repository = await prisma.repository.create({
      data: {
        name: options.name,
        type: 'remote',
        path: null,
        url: options.url,
        defaultBranch,
      },
    });

    logger.info('Remote repository registered', { id: repository.id, name: repository.name });
    return repository;
  }

  /**
   * リモートリポジトリのデフォルトブランチを取得
   */
  private async getRemoteDefaultBranch(url: string): Promise<string> {
    try {
      const { stdout } = await this.execFn(`git ls-remote --symref ${url} HEAD`);
      // パース: "ref: refs/heads/main\tHEAD" から "main" を取得
      const match = stdout.match(/ref: refs\/heads\/([^\t\n]+)/);
      if (match && match[1]) {
        return match[1];
      }
      throw new Error('Could not parse default branch from output');
    } catch (error) {
      logger.error('Failed to get default branch from remote repository', { url, error });
      throw new Error('Failed to get default branch from remote repository');
    }
  }

  /**
   * 一覧取得（セッション数を含む）
   */
  async findAll(): Promise<RepositoryWithSessionCount[]> {
    const repositories = await prisma.repository.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });

    return repositories.map(repo => ({
      ...repo,
      sessionCount: repo._count.sessions,
    }));
  }

  /**
   * ID指定で取得
   */
  async findById(id: string): Promise<Repository | null> {
    const repository = await prisma.repository.findUnique({
      where: { id },
    });
    return repository;
  }

  /**
   * 削除（関連セッションがある場合はエラー）
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting repository', { id });

    // リポジトリの存在確認
    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    if (!repository) {
      throw new RepositoryNotFoundError(id);
    }

    // 関連セッションの確認
    const sessionCount = await prisma.session.count({
      where: { repositoryId: id },
    });

    if (sessionCount > 0) {
      throw new RepositoryHasSessionsError(sessionCount);
    }

    await prisma.repository.delete({
      where: { id },
    });

    logger.info('Repository deleted', { id });
  }

  /**
   * ブランチ一覧取得
   */
  async getBranches(id: string): Promise<BranchInfo> {
    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    if (!repository) {
      throw new RepositoryNotFoundError(id);
    }

    if (repository.type === 'local') {
      return this.getLocalBranches(repository);
    } else {
      return this.getRemoteBranches(repository);
    }
  }

  /**
   * ローカルリポジトリのブランチ一覧を取得
   */
  private async getLocalBranches(repository: Repository): Promise<BranchInfo> {
    if (!repository.path) {
      throw new Error('Repository path is missing');
    }

    const branches = await this.filesystemService.getGitBranches(repository.path);

    return {
      branches,
      defaultBranch: repository.defaultBranch,
    };
  }

  /**
   * リモートリポジトリのブランチ一覧を取得
   */
  private async getRemoteBranches(repository: Repository): Promise<BranchInfo> {
    if (!repository.url) {
      throw new Error('Repository URL is missing');
    }

    const { stdout } = await this.execFn(`git ls-remote --heads ${repository.url}`);
    // パース: "aaaabbbb...\trefs/heads/main" から "main" を取得
    const branches = stdout
      .split('\n')
      .map(line => {
        const match = line.match(/refs\/heads\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter((branch): branch is string => branch !== null);

    return {
      branches,
      defaultBranch: repository.defaultBranch,
    };
  }
}
