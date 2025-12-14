import { spawnSync } from 'child_process';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { Logger } from 'winston';

/**
 * Git操作を管理するサービスクラス
 *
 * このクラスは、worktreeの作成・削除、差分取得、リベース、スカッシュマージなどの
 * Git操作を提供します。各セッションごとに独立したworktreeを作成することで、
 * 複数のClaude Codeセッションを並行して実行できるようにします。
 */
export class GitService {
  // セッション名とブランチ名の許可文字パターン
  private static readonly SAFE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

  /**
   * GitServiceのインスタンスを作成
   *
   * @param repoPath - Gitリポジトリのルートパス
   * @param logger - ログ出力用のWinstonロガー
   */
  constructor(
    private repoPath: string,
    private logger: Logger
  ) {}

  /**
   * セッション名のバリデーション
   *
   * パストラバーサル攻撃を防ぐため、セッション名とブランチ名を検証します。
   *
   * @param name - 検証する名前
   * @param type - 名前の種類（エラーメッセージ用）
   * @throws 不正な文字が含まれる場合にエラーをスロー
   */
  private validateName(name: string, type: 'session' | 'branch'): void {
    // ブランチ名の場合はスラッシュを許可（例: feature/xxx）
    const pattern = type === 'branch'
      ? /^[a-zA-Z0-9._/-]+$/
      : GitService.SAFE_NAME_PATTERN;

    if (!pattern.test(name)) {
      const allowedChars = type === 'branch'
        ? 'alphanumeric characters, dots, hyphens, underscores, and forward slashes'
        : 'alphanumeric characters, dots, hyphens, and underscores';
      throw new Error(
        `Invalid ${type} name: "${name}". Only ${allowedChars} are allowed.`
      );
    }

    // セッション名の場合はパス区切り文字を含む場合は拒否
    if (type === 'session' && (name.includes('/') || name.includes('\\'))) {
      throw new Error(`Invalid ${type} name: "${name}". Path separators are not allowed.`);
    }

    // バックスラッシュは両方とも拒否（Windowsパス区切りを防ぐ）
    if (name.includes('\\')) {
      throw new Error(`Invalid ${type} name: "${name}". Backslashes are not allowed.`);
    }

    // 相対パス表記を拒否
    if (name === '.' || name === '..') {
      throw new Error(`Invalid ${type} name: "${name}". Relative path notation is not allowed.`);
    }

    // セッション名の場合はドット始まりも拒否
    if (type === 'session' && name.startsWith('.')) {
      throw new Error(`Invalid ${type} name: "${name}". Names starting with a dot are not allowed for sessions.`);
    }

    // ダブルドット（..）を拒否（パストラバーサル）
    if (name.includes('..')) {
      throw new Error(`Invalid ${type} name: "${name}". Double dots (..) are not allowed.`);
    }
  }

  /**
   * Worktreeパスの検証
   *
   * worktreeパスがリポジトリの.worktrees配下にあることを確認します。
   *
   * @param worktreePath - 検証するworktreeパス
   * @throws パスがリポジトリ外の場合にエラーをスロー
   */
  private validateWorktreePath(worktreePath: string): void {
    const expectedBasePath = resolve(this.repoPath, '.worktrees');
    const actualPath = resolve(worktreePath);

    if (!actualPath.startsWith(expectedBasePath + '/') && actualPath !== expectedBasePath) {
      throw new Error(
        `Security error: Worktree path "${worktreePath}" is outside the repository's .worktrees directory.`
      );
    }
  }

  /**
   * 新しいGit worktreeを作成
   *
   * 指定されたセッション名とブランチ名で新しいworktreeを作成します。
   * worktreeは `.worktrees/[sessionName]` ディレクトリに作成されます。
   *
   * @param sessionName - セッション名（worktreeディレクトリ名として使用）
   * @param branchName - 作成するブランチ名
   * @returns 作成されたworktreeのパス
   * @throws Git操作が失敗した場合にエラーをスロー
   */
  createWorktree(sessionName: string, branchName: string): string {
    this.validateName(sessionName, 'session');
    this.validateName(branchName, 'branch');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);

    try {
      const result = spawnSync('git', ['worktree', 'add', '-b', branchName, worktreePath], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (result.error || result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || 'Failed to create worktree');
      }

      this.logger.info('Created worktree', { sessionName, branchName, worktreePath });
      return worktreePath;
    } catch (error) {
      this.logger.error('Failed to create worktree', { sessionName, branchName, error });
      throw error;
    }
  }

  /**
   * Git worktreeを削除
   *
   * 指定されたセッション名のworktreeを削除します。
   * worktreeが存在しない場合は警告をログに記録しますが、エラーをスローしません。
   *
   * @param sessionName - 削除するセッション名
   */
  deleteWorktree(sessionName: string): void {
    this.validateName(sessionName, 'session');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);

    try {
      const result = spawnSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (result.error || result.status !== 0) {
        const errorMsg = result.stderr || result.error?.message || '';

        // "存在しない"系のエラーは警告として握りつぶす
        if (errorMsg.includes('not found') ||
            errorMsg.includes('does not exist') ||
            errorMsg.includes('no such file or directory') ||
            errorMsg.includes('is not a working tree')) {
          this.logger.warn('Worktree does not exist (already removed)', { sessionName });
          return;
        }

        // その他のエラー（権限、ロック等）はthrow
        throw new Error(errorMsg || 'Failed to remove worktree');
      }

      this.logger.info('Deleted worktree', { sessionName });
    } catch (error) {
      this.logger.error('Failed to delete worktree', { sessionName, error });
      throw error;
    }
  }

  /**
   * mainブランチとの差分を取得
   *
   * 指定されたセッションのworktreeで、mainブランチとの差分を取得します。
   * 追加、変更、削除されたファイルのリストを返します。
   *
   * @param sessionName - 差分を取得するセッション名
   * @returns 追加、変更、削除されたファイルのパスを含むオブジェクト
   * @throws Git操作が失敗した場合にエラーをスロー
   */
  getDiff(sessionName: string): { added: string[]; modified: string[]; deleted: string[] } {
    this.validateName(sessionName, 'session');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);

    try {
      const result = spawnSync('git', ['diff', '--name-status', 'main...HEAD'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (result.error || result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || 'Failed to get diff');
      }

      const diffOutput = result.stdout || '';
      const added: string[] = [];
      const modified: string[] = [];
      const deleted: string[] = [];

      diffOutput.split('\n').forEach((line) => {
        if (!line) return;

        const [status, file] = line.split('\t');
        if (status === 'A') {
          added.push(file);
        } else if (status === 'M') {
          modified.push(file);
        } else if (status === 'D') {
          deleted.push(file);
        }
      });

      return { added, modified, deleted };
    } catch (error) {
      this.logger.error('Failed to get diff', { sessionName, error });
      throw error;
    }
  }

  /**
   * ファイルごとの詳細なdiff情報を取得
   *
   * 指定されたセッションのworktreeで、mainブランチとの差分を取得します。
   * 各ファイルの内容、追加行数、削除行数を含む詳細な情報を返します。
   *
   * @param sessionName - 差分を取得するセッション名
   * @returns ファイルごとの詳細なdiff情報を含む配列
   * @throws Git操作が失敗した場合にエラーをスロー
   */
  getDiffDetails(sessionName: string): {
    files: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted';
      additions: number;
      deletions: number;
      oldContent: string;
      newContent: string;
    }>;
    totalAdditions: number;
    totalDeletions: number;
  } {
    this.validateName(sessionName, 'session');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);

    try {
      // まず変更されたファイルのリストを取得
      const statusResult = spawnSync('git', ['diff', '--name-status', 'main...HEAD'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (statusResult.error || statusResult.status !== 0) {
        throw new Error(statusResult.stderr || statusResult.error?.message || 'Failed to get diff status');
      }

      const files: Array<{
        path: string;
        status: 'added' | 'modified' | 'deleted';
        additions: number;
        deletions: number;
        oldContent: string;
        newContent: string;
      }> = [];

      let totalAdditions = 0;
      let totalDeletions = 0;

      const statusOutput = statusResult.stdout || '';
      statusOutput.split('\n').forEach((line) => {
        if (!line) return;

        const [statusCode, filePath] = line.split('\t');
        let status: 'added' | 'modified' | 'deleted';

        if (statusCode === 'A') {
          status = 'added';
        } else if (statusCode === 'M') {
          status = 'modified';
        } else if (statusCode === 'D') {
          status = 'deleted';
        } else {
          return; // Unknown status
        }

        // ファイルの旧内容を取得（mainブランチから）
        let oldContent = '';
        if (status !== 'added') {
          const oldContentResult = spawnSync('git', ['show', `main:${filePath}`], {
            cwd: worktreePath,
            encoding: 'utf-8',
          });
          oldContent = oldContentResult.status === 0 ? oldContentResult.stdout : '';
        }

        // ファイルの新内容を取得（HEADから）
        let newContent = '';
        if (status !== 'deleted') {
          const newContentResult = spawnSync('git', ['show', `HEAD:${filePath}`], {
            cwd: worktreePath,
            encoding: 'utf-8',
          });
          newContent = newContentResult.status === 0 ? newContentResult.stdout : '';
        }

        // 追加行数と削除行数を計算
        const numstatResult = spawnSync('git', ['diff', '--numstat', 'main...HEAD', '--', filePath], {
          cwd: worktreePath,
          encoding: 'utf-8',
        });

        let additions = 0;
        let deletions = 0;

        if (numstatResult.status === 0 && numstatResult.stdout) {
          const numstatLine = numstatResult.stdout.trim();
          const [addStr, delStr] = numstatLine.split('\t');
          additions = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
          deletions = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
        }

        totalAdditions += additions;
        totalDeletions += deletions;

        files.push({
          path: filePath,
          status,
          additions,
          deletions,
          oldContent,
          newContent,
        });
      });

      return { files, totalAdditions, totalDeletions };
    } catch (error) {
      this.logger.error('Failed to get diff details', { sessionName, error });
      throw error;
    }
  }

  /**
   * mainブランチからリベースを実行
   *
   * 指定されたセッションのworktreeで、mainブランチからのリベースを試みます。
   * コンフリクトが発生した場合は、リベースを中止してコンフリクトファイルのリストを返します。
   *
   * @param sessionName - リベースを実行するセッション名
   * @returns リベースの成功/失敗とコンフリクトファイルのリスト（失敗時のみ）
   * @throws リベースの中止に失敗した場合にエラーをスロー
   */
  rebaseFromMain(sessionName: string): { success: boolean; conflicts?: string[] } {
    this.validateName(sessionName, 'session');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);

    try {
      const result = spawnSync('git', ['rebase', 'main'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (result.status === 0) {
        this.logger.info('Successfully rebased from main', { sessionName });
        return { success: true };
      }

      // Rebase failed, likely due to conflicts
      const conflictsResult = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      const conflicts = (conflictsResult.stdout || '')
        .split('\n')
        .filter((file) => file.length > 0);

      const abortResult = spawnSync('git', ['rebase', '--abort'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (abortResult.error || abortResult.status !== 0) {
        throw new Error(
          `Failed to abort rebase: ${abortResult.stderr || abortResult.error?.message || 'Unknown error'}`
        );
      }

      this.logger.warn('Rebase conflicts detected', { sessionName, conflicts });
      return { success: false, conflicts };
    } catch (error) {
      this.logger.error('Failed to rebase', { sessionName, error });
      throw error;
    }
  }

  /**
   * セッションブランチをmainにスカッシュマージ
   *
   * 指定されたセッションのworktreeのブランチを、mainブランチにスカッシュマージします。
   * すべてのコミットを1つにまとめて、指定されたコミットメッセージでコミットします。
   * また、.gitignoreに.worktrees/が含まれていない場合は自動的に追加します。
   *
   * @param sessionName - マージするセッション名
   * @param commitMessage - マージコミットのメッセージ
   * @returns マージの成功/失敗とコンフリクトファイルのリスト（失敗時のみ）
   * @throws マージの中止に失敗した場合にエラーをスロー
   */
  squashMerge(sessionName: string, commitMessage: string): { success: boolean; conflicts?: string[] } {
    this.validateName(sessionName, 'session');

    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    this.validateWorktreePath(worktreePath);
    const gitignorePath = join(this.repoPath, '.gitignore');

    try {
      // mainブランチにいることを確認
      const currentBranchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (currentBranchResult.error || currentBranchResult.status !== 0) {
        throw new Error(currentBranchResult.stderr || 'Failed to get current branch');
      }

      const currentBranch = currentBranchResult.stdout.trim();
      if (currentBranch !== 'main') {
        throw new Error(`Cannot squash merge: currently on branch "${currentBranch}", but must be on "main"`);
      }

      // worktreeのブランチ名を取得
      const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (branchResult.error || branchResult.status !== 0) {
        throw new Error(branchResult.stderr || 'Failed to get branch name');
      }

      const branchName = branchResult.stdout.trim();

      // Ensure .gitignore exists and contains .worktrees/
      let gitignoreContent = '';
      let gitignoreUpdated = false;
      if (existsSync(gitignorePath)) {
        gitignoreContent = readFileSync(gitignorePath, 'utf-8');
      }
      const lines = gitignoreContent.split('\n');
      if (!lines.some((line) => line.trim() === '.worktrees/')) {
        writeFileSync(gitignorePath, gitignoreContent + (gitignoreContent ? '\n' : '') + '.worktrees/\n');
        gitignoreUpdated = true;
      }

      const mergeResult = spawnSync('git', ['merge', '--squash', branchName], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (mergeResult.error || mergeResult.status !== 0) {
        // Check for conflicts
        const conflictsResult = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
          cwd: this.repoPath,
          encoding: 'utf-8',
        });

        const conflicts = (conflictsResult.stdout || '')
          .split('\n')
          .filter((file) => file.length > 0);

        if (conflicts.length > 0) {
          spawnSync('git', ['reset', '--merge'], {
            cwd: this.repoPath,
          });

          this.logger.warn('Squash merge conflicts detected', { sessionName, conflicts });
          return { success: false, conflicts };
        }

        const errorMsg = mergeResult.stderr || mergeResult.stdout || 'Failed to squash merge';
        throw new Error(errorMsg);
      }

      // Add .gitignore if it was updated
      if (gitignoreUpdated) {
        spawnSync('git', ['add', '.gitignore'], {
          cwd: this.repoPath,
        });
      }

      const commitResult = spawnSync('git', ['commit', '-m', commitMessage], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (commitResult.error || commitResult.status !== 0) {
        throw new Error(commitResult.stderr || 'Failed to commit');
      }

      this.logger.info('Successfully squash merged', { sessionName, commitMessage });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to squash merge', { sessionName, error });
      throw error;
    }
  }
}
