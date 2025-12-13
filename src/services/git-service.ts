import { spawnSync } from 'child_process';
import { join } from 'path';
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
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);

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
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);

    try {
      const result = spawnSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: this.repoPath,
        encoding: 'utf-8',
      });

      if (result.error || result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || 'Failed to remove worktree');
      }

      this.logger.info('Deleted worktree', { sessionName });
    } catch (error) {
      this.logger.warn('Failed to delete worktree (may not exist)', { sessionName, error });
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
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);

    try {
      const result = spawnSync('git', ['diff', '--name-status', 'main...HEAD'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      if (result.error) {
        throw new Error(result.error.message);
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
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);

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

      spawnSync('git', ['rebase', '--abort'], {
        cwd: worktreePath,
      });

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
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    const gitignorePath = join(this.repoPath, '.gitignore');

    try {
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
      if (!gitignoreContent.includes('.worktrees/')) {
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
