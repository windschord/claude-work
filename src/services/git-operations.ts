/**
 * GitOperations インターフェース
 * Git操作の抽象化
 */

/**
 * Git操作の結果
 */
export interface GitOperationResult {
  success: boolean;
  message?: string;
  error?: Error;
}

/**
 * Git clone オプション
 */
export interface GitCloneOptions {
  url: string;
  projectId: string;
  environmentId?: string;
  timeoutMs?: number;
}

/**
 * Git worktree作成オプション
 */
export interface GitWorktreeOptions {
  projectId: string;
  sessionName: string;
  branchName: string;
}

/**
 * GitOperations インターフェース
 * ホスト環境とDocker環境で共通のGit操作を定義
 */
export interface GitOperations {
  /**
   * リポジトリをcloneする
   */
  cloneRepository(options: GitCloneOptions): Promise<GitOperationResult>;

  /**
   * worktreeを作成する
   */
  createWorktree(options: GitWorktreeOptions): Promise<GitOperationResult>;

  /**
   * worktreeを削除する
   */
  deleteWorktree(projectId: string, sessionName: string): Promise<GitOperationResult>;

  /**
   * リポジトリを削除する
   */
  deleteRepository(projectId: string): Promise<GitOperationResult>;
}

/**
 * Git操作エラー
 */
export class GitOperationError extends Error {
  constructor(
    message: string,
    public environment: 'host' | 'docker',
    public operation: 'clone' | 'worktree' | 'volume',
    public recoverable: boolean,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}
