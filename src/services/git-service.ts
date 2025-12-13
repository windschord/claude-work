import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { Logger } from 'winston';

export class GitService {
  constructor(
    private repoPath: string,
    private logger: Logger
  ) {}

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

  rebaseFromMain(sessionName: string): { success: boolean; conflicts?: string[] } {
    const worktreePath = join(this.repoPath, '.worktrees', sessionName);

    try {
      execSync('git rebase main', {
        cwd: worktreePath,
        stdio: 'pipe',
      });

      this.logger.info('Successfully rebased from main', { sessionName });
      return { success: true };
    } catch (error) {
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
