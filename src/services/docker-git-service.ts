import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { Writable } from 'stream';
import { logger } from '@/lib/logger';
import { getConfigService } from './config-service';
import { DockerClient } from './docker-client';
import {
  GitOperations,
  GitCloneOptions,
  GitWorktreeOptions,
  GitOperationResult,
  GitOperationError,
} from './git-operations';

/**
 * DockerGitService
 * Docker環境でのGit操作を管理
 */
export class DockerGitService implements GitOperations {
  private configService = getConfigService();

  // Non-recoverable error patterns - these require user action, not retries
  private static readonly PERMANENT_ERROR_PATTERNS = [
    'no such file or directory',
    'permission denied',
    'repository not found',
    'authentication failed',
    'could not resolve host',
    'repository does not exist',
    'access denied',
  ];

  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly BASE_DELAY_MS = 1000;

  private static readonly SAFE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  private static readonly SAFE_HASH_PATTERN = /^[a-fA-F0-9]+$/;

  private validateSessionName(name: string): void {
    if (!DockerGitService.SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid session name: "${name}". Only alphanumeric characters, dots, hyphens, and underscores are allowed.`);
    }
    if (name === '.' || name === '..' || name.includes('..')) {
      throw new Error(`Invalid session name: "${name}". Path traversal is not allowed.`);
    }
  }

  private validateCommitHash(hash: string): void {
    if (!DockerGitService.SAFE_HASH_PATTERN.test(hash)) {
      throw new Error(`Invalid commit hash: "${hash}". Only hexadecimal characters are allowed.`);
    }
  }

  /**
   * Dockerボリューム名を生成
   */
  private getVolumeName(projectId: string): string {
    return `claude-repo-${projectId}`;
  }

  /**
   * Dockerボリュームを作成
   */
  async createVolume(projectId: string): Promise<string> {
    const volumeName = this.getVolumeName(projectId);

    try {
      logger.info('[docker] Creating Docker volume', { volumeName });

      await DockerClient.getInstance().createVolume(volumeName);

      logger.info('[docker] Docker volume created', { volumeName });
      return volumeName;
    } catch (error) {
      logger.error('[docker] Failed to create Docker volume', { error, volumeName });
      throw new GitOperationError(
        `Failed to create Docker volume: ${volumeName}`,
        'docker',
        'volume',
        false,
        error as Error
      );
    }
  }

  /**
   * Dockerボリュームを削除
   */
  async deleteVolume(volumeName: string): Promise<void> {
    const keepVolumes = this.configService.getDebugModeKeepVolumes();

    if (keepVolumes) {
      logger.info('[docker] [DEBUG MODE] Keeping Docker volume', { volumeName });
      return;
    }

    try {
      logger.info('[docker] Deleting Docker volume', { volumeName });

      await DockerClient.getInstance().removeVolume(volumeName);

      logger.info('[docker] Docker volume deleted', { volumeName });
    } catch (error) {
      logger.error('[docker] Failed to delete Docker volume', { error, volumeName });
      throw new Error(`Failed to delete Docker volume: ${volumeName}. Please run: docker volume rm ${volumeName}`);
    }
  }

  /**
   * 認証情報のBindsとEnv配列を構築するヘルパー
   */
  private async buildAuthBindsAndEnv(): Promise<{ Binds: string[], Env: string[] }> {
    const Binds: string[] = [];
    const Env: string[] = [];
    const homeDir = os.homedir();

    // SSH鍵（読み取り専用）
    const sshDir = path.join(homeDir, '.ssh');
    try {
      await fs.access(sshDir);
      Binds.push(`${sshDir}:/root/.ssh:ro`);
    } catch {}

    // SSH Agent socket
    const sshAuthSock = process.env.SSH_AUTH_SOCK;
    if (sshAuthSock) {
      Binds.push(`${sshAuthSock}:/ssh-agent`);
      Env.push('SSH_AUTH_SOCK=/ssh-agent');
    }

    // Git設定（読み取り専用）
    const gitconfig = path.join(homeDir, '.gitconfig');
    try {
      await fs.access(gitconfig);
      Binds.push(`${gitconfig}:/root/.gitconfig:ro`);
    } catch {}

    // gh CLI認証（読み取り専用）
    const ghConfig = path.join(homeDir, '.config', 'gh');
    try {
      await fs.access(ghConfig);
      Binds.push(`${ghConfig}:/root/.config/gh:ro`);
    } catch {}

    return { Binds, Env };
  }

  /**
   * エラーが永続的（リトライ不要）かどうかを判定
   */
  private isPermanentError(error: Error): boolean {
    const messages: string[] = [error.message || ''];
    const extendedError = error as unknown as Record<string, unknown>;
    if (typeof extendedError.stderr === 'string') {
      messages.push(extendedError.stderr);
    }
    if (typeof extendedError.stdout === 'string') {
      messages.push(extendedError.stdout);
    }
    const combinedMessage = messages.join('\n').toLowerCase();
    return DockerGitService.PERMANENT_ERROR_PATTERNS.some(
      (pattern) => combinedMessage.includes(pattern)
    );
  }

  /**
   * エラーオブジェクトからPATを除去したErrorを返す
   */
  private sanitizeError(error: Error): Error {
    const pat = /GIT_PAT=[^\s]*/g;
    const sanitized = new Error(
      (error.message || '').replace(pat, 'GIT_PAT=***')
    );
    sanitized.stack = error.stack?.replace(pat, 'GIT_PAT=***');
    const ext = error as unknown as Record<string, unknown>;
    if (typeof ext.stderr === 'string') {
      (sanitized as unknown as Record<string, unknown>).stderr = ext.stderr.replace(pat, 'GIT_PAT=***');
    }
    if (typeof ext.stdout === 'string') {
      (sanitized as unknown as Record<string, unknown>).stdout = ext.stdout.replace(pat, 'GIT_PAT=***');
    }
    return sanitized;
  }

  /**
   * URLから認証情報を除去する
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) {
        parsed.username = '***';
        parsed.password = '***';
        return parsed.toString();
      }
      return url;
    } catch {
      return url;
    }
  }

  /**
   * 指定ミリ秒待機する
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 指数バックオフ付きリトライ
   * 一時的エラーでは最大MAX_RETRY_ATTEMPTS回リトライ、永続エラーでは即座に失敗
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationType: 'clone' | 'worktree' | 'volume',
  ): Promise<T> {
    const maxAttempts = DockerGitService.MAX_RETRY_ATTEMPTS;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const safeMessage = (lastError.message || '').replace(/GIT_PAT=[^\s]*/g, 'GIT_PAT=***');

        if (this.isPermanentError(lastError)) {
          throw new GitOperationError(
            `Permanent error during ${operationType}: ${safeMessage}`,
            'docker',
            operationType,
            false,
            this.sanitizeError(lastError)
          );
        }

        if (attempt === maxAttempts) {
          break;
        }

        const delay = DockerGitService.BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`[docker] ${operationType} attempt ${attempt} failed, retrying (${attempt + 1}/${maxAttempts}) after ${delay}ms`, {
          error: safeMessage,
          attempt,
          delay,
        });
        await this.sleep(delay);
      }
    }

    const safeMessage = (lastError!.message || '').replace(/GIT_PAT=[^\s]*/g, 'GIT_PAT=***');
    throw new GitOperationError(
      `All retry attempts failed for ${operationType}: ${safeMessage}`,
      'docker',
      operationType,
      true,
      this.sanitizeError(lastError!)
    );
  }

  /**
   * コンテナを実行して終了を待つヘルパー
   */
  private async runContainer(
    image: string,
    cmd: string[],
    options: { Binds?: string[]; Env?: string[]; WorkingDir?: string; Entrypoint?: string | string[]; timeoutMs?: number }
  ): Promise<{ stdout: string; stderr: string }> {
    let stdout = '';
    let stderr = '';
    
    const stdoutStream = new Writable({
      write(chunk, encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });
    
    const stderrStream = new Writable({
      write(chunk, encoding, callback) {
        stderr += chunk.toString();
        callback();
      }
    });

    const runPromise = DockerClient.getInstance().run(
      image,
      cmd,
      [stdoutStream, stderrStream] as any,
      {
        HostConfig: {
          Binds: options.Binds,
          AutoRemove: true,
        },
        Env: options.Env,
        WorkingDir: options.WorkingDir,
        Entrypoint: options.Entrypoint,
      }
    );

    try {
      let data: { StatusCode: number };

      if (options.timeoutMs && options.timeoutMs > 0) {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          // Note: On timeout, the container process continues running in the background.
          // However, AutoRemove: true is set on the container, so it will be automatically
          // cleaned up by Docker when the container process eventually exits.
          setTimeout(() => reject(new Error(`Container operation timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
        });
        data = await Promise.race([runPromise, timeoutPromise]);
      } else {
        data = await runPromise;
      }

      if (data.StatusCode !== 0) {
        const error = new Error(`Command failed with code ${data.StatusCode}`);
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        throw error;
      }

      return { stdout, stderr };
    } catch (error: any) {
      if (!error.stderr && stderr) {
        error.stderr = stderr;
      }
      if (!error.stdout && stdout) {
        error.stdout = stdout;
      }
      throw error;
    }
  }

  /**
   * リポジトリをcloneする
   */
  async cloneRepository(options: GitCloneOptions): Promise<GitOperationResult> {
    const { url, projectId } = options;
    const timeout = options.timeoutMs || this.configService.getGitCloneTimeoutMs();
    let volumeName: string | null = null;

    try {
      // 1. Dockerボリューム作成
      volumeName = await this.createVolume(projectId);

      // 2. 認証情報マウントオプション構築
      const auth = await this.buildAuthBindsAndEnv();
      const Binds = [`${volumeName}:/repo`, ...auth.Binds];
      const Env = [...auth.Env];

      logger.info('[docker] Starting git clone', { url, volumeName, timeout });

      // 4. git clone実行（リトライ付き）
      const startTime = Date.now();
      await this.retryWithBackoff(
        () => this.runContainer('alpine/git', ['clone', url, '/repo'], { Binds, Env, timeoutMs: timeout }),
        'clone',
      );
      const duration = Date.now() - startTime;

      logger.info('[docker] git clone completed', { url, volumeName, duration });

      return {
        success: true,
        message: `Repository cloned successfully to Docker volume: ${volumeName}`,
      };
    } catch (error) {
      logger.error('[docker] git clone failed', { error, url, volumeName });

      // エラー時はボリュームを削除
      if (volumeName) {
        try {
          await this.deleteVolume(volumeName);
        } catch (cleanupError) {
          logger.error('[docker] Failed to cleanup volume after clone failure', { cleanupError, volumeName });
        }
      }

      if (error instanceof GitOperationError) throw error;

      throw new GitOperationError(
        `Failed to clone repository in Docker environment`,
        'docker',
        'clone',
        true,
        this.sanitizeError(error as Error)
      );
    }
  }

  /**
   * worktreeを作成する
   */
  async createWorktree(options: GitWorktreeOptions): Promise<GitOperationResult> {
    const { projectId, sessionName, branchName } = options;
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);

    try {
      const auth = await this.buildAuthBindsAndEnv();
      const Binds = [`${volumeName}:/repo`, ...auth.Binds];
      const Env = [...auth.Env];

      const cmd = ['-C', '/repo', 'worktree', 'add', `/repo/.worktrees/${sessionName}`, '-b', branchName];

      logger.info('[docker] Creating worktree', { projectId, sessionName, branchName });

      const startTime = Date.now();
      await this.retryWithBackoff(
        () => this.runContainer('alpine/git', cmd, { Binds, Env }),
        'worktree',
      );
      const duration = Date.now() - startTime;

      logger.info('[docker] worktree created', { projectId, sessionName, duration });

      return {
        success: true,
        message: `Worktree created successfully: ${sessionName}`,
      };
    } catch (error) {
      logger.error('[docker] Failed to create worktree', { error, projectId, sessionName });

      if (error instanceof GitOperationError) throw error;

      throw new GitOperationError(
        `Failed to create worktree in Docker environment`,
        'docker',
        'worktree',
        true,
        this.sanitizeError(error as Error)
      );
    }
  }

  /**
   * worktreeを削除する
   */
  async deleteWorktree(projectId: string, sessionName: string): Promise<GitOperationResult> {
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);

    try {
      const Binds = [`${volumeName}:/repo`];
      const cmd = ['-C', '/repo', 'worktree', 'remove', `.worktrees/${sessionName}`];

      logger.info('[docker] Deleting worktree', { projectId, sessionName });

      await this.runContainer('alpine/git', cmd, { Binds });

      logger.info('[docker] worktree deleted', { projectId, sessionName });

      return {
        success: true,
        message: `Worktree deleted successfully: ${sessionName}`,
      };
    } catch (error) {
      logger.error('[docker] Failed to delete worktree', { error, projectId, sessionName });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * PAT認証でリポジトリをcloneする
   * HTTPS URLのみサポート。credential helperを使ってPATで認証する。
   */
  async cloneRepositoryWithPAT(
    repoUrl: string,
    projectId: string,
    pat: string
  ): Promise<GitOperationResult> {
    // HTTPS URLのみ許可
    if (!repoUrl.startsWith('https://')) {
      throw new GitOperationError(
        'PAT authentication requires HTTPS URL',
        'docker',
        'clone',
        false
      );
    }

    const timeout = this.configService.getGitCloneTimeoutMs();
    let volumeName: string | null = null;

    try {
      // 1. Dockerボリューム作成
      volumeName = await this.createVolume(projectId);

      // 2. credential helper設定 + git cloneを実行するシェルコマンド
      const shellCommand = [
        'git config --global credential.helper \'!f() { echo "username=x-access-token"; echo "password=$GIT_PAT"; }; f\'',
        'git clone "$REPO_URL" /repo',
      ].join(' && ');

      const Binds = [`${volumeName}:/repo`];
      const Env = [`GIT_PAT=${pat}`, `REPO_URL=${repoUrl}`];

      logger.info('[docker] Starting git clone with PAT', { repoUrl: this.sanitizeUrl(repoUrl), volumeName, timeout });

      // 4. git clone実行（リトライ付き）
      const startTime = Date.now();
      await this.retryWithBackoff(
        () => this.runContainer('alpine/git', ['-c', shellCommand], {
            Binds,
            Env,
            Entrypoint: 'sh',
            timeoutMs: timeout,
        }),
        'clone',
      );
      const duration = Date.now() - startTime;

      logger.info('[docker] git clone with PAT completed', { repoUrl: this.sanitizeUrl(repoUrl), volumeName, duration });

      return {
        success: true,
        message: `Repository cloned successfully with PAT to Docker volume: ${volumeName}`,
      };
    } catch (error) {
      logger.error('[docker] git clone with PAT failed', { error: this.sanitizeError(error as Error), repoUrl: this.sanitizeUrl(repoUrl), volumeName });

      // エラー時はボリュームを削除
      if (volumeName) {
        try {
          await this.deleteVolume(volumeName);
        } catch (cleanupError) {
          logger.error('[docker] Failed to cleanup volume after PAT clone failure', { cleanupError, volumeName });
        }
      }

      if (error instanceof GitOperationError) throw error;

      throw new GitOperationError(
        'Failed to clone repository with PAT in Docker environment',
        'docker',
        'clone',
        true,
        this.sanitizeError(error as Error)
      );
    }
  }

  /**
   * リポジトリを削除する（Dockerボリュームを削除）
   */
  async deleteRepository(projectId: string): Promise<GitOperationResult> {
    const volumeName = this.getVolumeName(projectId);

    try {
      await this.deleteVolume(volumeName);

      return {
        success: true,
        message: `Repository deleted successfully: ${volumeName}`,
      };
    } catch (error) {
      logger.error('[docker] Failed to delete repository', { error, projectId });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * ファイルごとの詳細なdiff情報を取得
   */
  async getDiffDetails(projectId: string, sessionName: string): Promise<{
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
  }> {
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);
    const worktreePath = `/repo/.worktrees/${sessionName}`;
    const Binds = [`${volumeName}:/repo`];

    const script = `
      git diff --name-status main...HEAD | while IFS=$'\\t' read -r status file1 file2; do
        file="$file1"
        case "$status" in
          R*|C*) file="$file2" ;;
        esac
        printf '===FILE_START===\\n'
        printf 'PATH:%s\\n' "$file"
        printf 'STATUS:%s\\n' "$status"

        if [ "$status" != "A" ]; then
          printf '===OLD_CONTENT_B64===\\n'
          git show main:"$file" 2>/dev/null | base64 || true
          printf '===OLD_CONTENT_B64_END===\\n'
        fi

        if [ "$status" != "D" ]; then
          printf '===NEW_CONTENT_B64===\\n'
          git show HEAD:"$file" 2>/dev/null | base64 || true
          printf '===NEW_CONTENT_B64_END===\\n'
        fi

        printf '===NUMSTAT_START===\\n'
        git diff --numstat main...HEAD -- "$file"
        printf '===FILE_END===\\n'
      done
    `;

    try {
      const { stdout } = await this.runContainer('alpine/git', ['-c', script], {
        Binds,
        WorkingDir: worktreePath,
        Entrypoint: ['/bin/sh'],
      });

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

      const chunks = stdout.split('===FILE_START===');
      
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        const pathMatch = chunk.match(/PATH:(.*)/);
        const statusMatch = chunk.match(/STATUS:(.*)/);
        
        if (!pathMatch || !statusMatch) continue;

        const filePath = pathMatch[1].trim();
        const statusCode = statusMatch[1].trim();
        let status: 'added' | 'modified' | 'deleted';

        if (statusCode === 'A') status = 'added';
        else if (statusCode === 'M' || statusCode.startsWith('R') || statusCode.startsWith('C')) status = 'modified';
        else if (statusCode === 'D') status = 'deleted';
        else continue;

        let oldContent = '';
        const oldContentMatch = chunk.match(/===OLD_CONTENT_B64===\n([\s\S]*?)===OLD_CONTENT_B64_END===/);
        if (oldContentMatch) {
          try {
            oldContent = Buffer.from(oldContentMatch[1].trim(), 'base64').toString('utf-8');
          } catch { oldContent = ''; }
        }

        let newContent = '';
        const newContentMatch = chunk.match(/===NEW_CONTENT_B64===\n([\s\S]*?)===NEW_CONTENT_B64_END===/);
        if (newContentMatch) {
          try {
            newContent = Buffer.from(newContentMatch[1].trim(), 'base64').toString('utf-8');
          } catch { newContent = ''; }
        }

        let additions = 0;
        let deletions = 0;
        const numstatMatch = chunk.match(/===NUMSTAT_START===\s*([\d-]+)\s+([\d-]+)/);
        if (numstatMatch) {
          const addStr = numstatMatch[1];
          const delStr = numstatMatch[2];
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
      }

      return { files, totalAdditions, totalDeletions };
    } catch (error) {
      logger.error('[docker] Failed to get diff details', { error, projectId, sessionName });
      throw error;
    }
  }

  /**
   * mainブランチからリベースを実行
   */
  async rebaseFromMain(projectId: string, sessionName: string): Promise<{ success: boolean; conflicts?: string[] }> {
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);
    const worktreePath = `/repo/.worktrees/${sessionName}`;
    const Binds = [`${volumeName}:/repo`];

    try {
      await this.runContainer('alpine/git', ['rebase', 'main'], {
        Binds,
        WorkingDir: worktreePath,
      });

      return { success: true };
    } catch (error: any) {
      // コンフリクトの確認
      try {
        const { stdout: conflictFiles } = await this.runContainer('alpine/git', ['diff', '--name-only', '--diff-filter=U'], {
          Binds,
          WorkingDir: worktreePath,
        });

        const conflicts = conflictFiles.split('\n').filter(f => f.trim().length > 0);

        // Abort rebase
        await this.runContainer('alpine/git', ['rebase', '--abort'], {
          Binds,
          WorkingDir: worktreePath,
        });

        if (conflicts.length > 0) {
          logger.warn('[docker] Rebase conflicts detected', { sessionName, conflicts });
          return { success: false, conflicts };
        }

        // No conflicts - different error, re-throw
        throw error;
      } catch (innerError) {
        if (innerError === error) throw error;
        logger.error('[docker] Failed to handle rebase failure', { innerError, originalError: error });
        throw error;
      }
    }
  }

  /**
   * セッションブランチをmainにスカッシュマージ
   */
  async squashMerge(projectId: string, sessionName: string, commitMessage: string): Promise<{ success: boolean; conflicts?: string[] }> {
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);
    const Binds = [`${volumeName}:/repo`];

    // Note: We operate in /repo (main repo), not worktree
    try {
      // Ensure we are on main
      await this.runContainer('alpine/git', ['checkout', 'main'], { Binds, WorkingDir: '/repo' });

      // Ensure .gitignore has .worktrees/
      const ensureGitignore = `
        if [ -f .gitignore ]; then
          if ! grep -q ".worktrees/" .gitignore; then
            echo ".worktrees/" >> .gitignore
          fi
        else
          echo ".worktrees/" > .gitignore
        fi
      `;
      await this.runContainer('alpine/git', ['-c', ensureGitignore], {
         Binds, 
         WorkingDir: '/repo', 
         Entrypoint: ['/bin/sh'] 
      });

      // Squash merge
      // We merge the branch from the worktree: session/<sessionName>
      // The branch ref should be available in the shared repo object.
      await this.runContainer('alpine/git', ['merge', '--squash', `session/${sessionName}`], {
        Binds,
        WorkingDir: '/repo',
      });

      // Commit
      // We must add .gitignore if it was modified.
      await this.runContainer('alpine/git', ['add', '.gitignore'], { Binds, WorkingDir: '/repo' });
      
      await this.runContainer('alpine/git', ['commit', '-m', commitMessage], {
        Binds,
        WorkingDir: '/repo',
      });

      return { success: true };
    } catch (error: any) {
       // Check for conflicts
       try {
         const { stdout: conflictFiles } = await this.runContainer('alpine/git', ['diff', '--name-only', '--diff-filter=U'], {
           Binds,
           WorkingDir: '/repo',
         });
 
         const conflicts = conflictFiles.split('\n').filter(f => f.trim().length > 0);
 
         if (conflicts.length > 0) {
           // Abort merge (reset --merge)
           await this.runContainer('alpine/git', ['reset', '--merge'], {
             Binds,
             WorkingDir: '/repo',
           });
 
           logger.warn('[docker] Squash merge conflicts detected', { sessionName, conflicts });
           return { success: false, conflicts };
         }
         
         throw error;
       } catch (innerError) {
         if (innerError === error) throw error; // If same error rethrown
         logger.error('[docker] Failed to handle merge failure', { innerError, originalError: error });
         throw error;
       }
    }
  }

  /**
   * セッションのコミット履歴を取得
   */
  async getCommits(projectId: string, sessionName: string): Promise<Array<{
    hash: string;
    short_hash: string;
    message: string;
    author: string;
    date: string;
    files_changed: number;
  }>> {
    this.validateSessionName(sessionName);
    const volumeName = this.getVolumeName(projectId);
    const worktreePath = `/repo/.worktrees/${sessionName}`;
    const Binds = [`${volumeName}:/repo`];

    try {
      const delimiter = '===COMMIT_DELIM===';
      const format = `%H${delimiter}%h${delimiter}%s${delimiter}%an${delimiter}%aI`;
      const { stdout } = await this.runContainer('alpine/git', ['log', `--pretty=format:${format}`, '--numstat', 'main..HEAD'], {
        Binds,
        WorkingDir: worktreePath,
      });

      const output = stdout.trim();
      if (!output) return [];

      const commits: Array<{
        hash: string;
        short_hash: string;
        message: string;
        author: string;
        date: string;
        files_changed: number;
      }> = [];

      const lines = output.split('\n');
      let currentCommit: any = null;
      let filesChanged = 0;

      for (const line of lines) {
        if (line.includes(delimiter)) {
          if (currentCommit) {
            currentCommit.files_changed = filesChanged;
            commits.push(currentCommit);
            filesChanged = 0;
          }

          const [hash, short_hash, message, author, date] = line.split(delimiter);
          currentCommit = {
            hash,
            short_hash,
            message,
            author,
            date,
            files_changed: 0,
          };
        } else if (line.trim() && currentCommit) {
          filesChanged++;
        }
      }

      if (currentCommit) {
        currentCommit.files_changed = filesChanged;
        commits.push(currentCommit);
      }

      return commits;
    } catch (error) {
      logger.error('[docker] Failed to get commits', { error, projectId, sessionName });
      return [];
    }
  }

  /**
   * 指定されたコミットにリセット
   */
  async reset(projectId: string, sessionName: string, commitHash: string): Promise<{ success: boolean; error?: string }> {
    this.validateSessionName(sessionName);
    this.validateCommitHash(commitHash);
    const volumeName = this.getVolumeName(projectId);
    const worktreePath = `/repo/.worktrees/${sessionName}`;
    const Binds = [`${volumeName}:/repo`];

    try {
      await this.runContainer('alpine/git', ['reset', '--hard', commitHash], {
        Binds,
        WorkingDir: worktreePath,
      });

      return { success: true };
    } catch (error: any) {
      const errorMsg = error.stderr || error.message || String(error);
      logger.error('[docker] Failed to reset', { error, projectId, sessionName, commitHash });
      return { success: false, error: errorMsg };
    }
  }
}
