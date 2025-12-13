import { execSync } from 'child_process';
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
      execSync(`git worktree add -b ${branchName} ${worktreePath}`, {
        cwd: this.repoPath,
      });
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
      execSync(`git worktree remove ${worktreePath} --force`, {
        cwd: this.repoPath,
      });
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
      const diffOutput = execSync('git diff --name-status main...HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

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
      execSync('git rebase main', {
        cwd: worktreePath,
        stdio: 'pipe',
      });

      this.logger.info('Successfully rebased from main', { sessionName });
      return { success: true };
    } catch {
      try {
        const conflictsOutput = execSync('git diff --name-only --diff-filter=U', {
          cwd: worktreePath,
          encoding: 'utf-8',
        });

        const conflicts = conflictsOutput
          .split('\n')
          .filter((file) => file.length > 0);

        execSync('git rebase --abort', {
          cwd: worktreePath,
        });

        this.logger.warn('Rebase conflicts detected', { sessionName, conflicts });
        return { success: false, conflicts };
      } catch (abortError) {
        this.logger.error('Failed to handle rebase conflict', { sessionName, error: abortError });
        throw abortError;
      }
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
   * @throws マージやコミットが失敗した場合にエラーをスロー
   */
  squashMerge(sessionName: string, commitMessage: string): void {
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);
    const gitignorePath = join(this.repoPath, '.gitignore');

    try {
      const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

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

      execSync(`git merge --squash ${branchName}`, {
        cwd: this.repoPath,
        stdio: 'pipe',
      });

      // Add .gitignore if it was updated
      if (gitignoreUpdated) {
        execSync('git add .gitignore', {
          cwd: this.repoPath,
          stdio: 'pipe',
        });
      }

      execSync(`git commit -m "${commitMessage}"`, {
        cwd: this.repoPath,
        stdio: 'pipe',
      });

      this.logger.info('Successfully squash merged', { sessionName, commitMessage });
    } catch (error) {
      this.logger.error('Failed to squash merge', { sessionName, error });
      throw error;
    }
  }
}
