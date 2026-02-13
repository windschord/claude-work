import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/logger';
import { getConfigService } from './config-service';
import {
  GitOperations,
  GitCloneOptions,
  GitWorktreeOptions,
  GitOperationResult,
  GitOperationError,
} from './git-operations';

const execFileAsync = promisify(execFile);

/**
 * DockerGitService
 * Docker環境でのGit操作を管理
 */
export class DockerGitService implements GitOperations {
  private configService = getConfigService();

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

      await execFileAsync('docker', ['volume', 'create', volumeName], {
        timeout: 30000, // 30秒
      });

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

      await execFileAsync('docker', ['volume', 'rm', volumeName], {
        timeout: 30000, // 30秒
      });

      logger.info('[docker] Docker volume deleted', { volumeName });
    } catch (error) {
      logger.error('[docker] Failed to delete Docker volume', { error, volumeName });
      throw new Error(`Failed to delete Docker volume: ${volumeName}. Please run: docker volume rm ${volumeName}`);
    }
  }

  /**
   * 認証情報マウントオプションを構築
   */
  private async buildAuthMounts(): Promise<string[]> {
    const mounts: string[] = [];
    const homeDir = os.homedir();

    // SSH鍵（読み取り専用）
    const sshDir = path.join(homeDir, '.ssh');
    try {
      await fs.access(sshDir);
      mounts.push('-v', `${sshDir}:/root/.ssh:ro`);
      logger.info('[docker] Mounting SSH keys');
    } catch {
      logger.warn('[docker] SSH directory not found, skipping');
    }

    // SSH Agent socket
    const sshAuthSock = process.env.SSH_AUTH_SOCK;
    if (sshAuthSock) {
      mounts.push('-v', `${sshAuthSock}:/ssh-agent`);
      mounts.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
      logger.info('[docker] Mounting SSH Agent socket');
    } else {
      logger.warn('[docker] SSH_AUTH_SOCK not set, skipping');
    }

    // Git設定（読み取り専用）
    const gitconfig = path.join(homeDir, '.gitconfig');
    try {
      await fs.access(gitconfig);
      mounts.push('-v', `${gitconfig}:/root/.gitconfig:ro`);
      logger.info('[docker] Mounting .gitconfig');
    } catch {
      logger.warn('[docker] .gitconfig not found, skipping');
    }

    // gh CLI認証（読み取り専用）
    const ghConfig = path.join(homeDir, '.config', 'gh');
    try {
      await fs.access(ghConfig);
      mounts.push('-v', `${ghConfig}:/root/.config/gh:ro`);
      logger.info('[docker] Mounting gh CLI authentication');
    } catch {
      logger.warn('[docker] gh CLI authentication not found (optional), skipping');
    }

    return mounts;
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
      const authMounts = await this.buildAuthMounts();

      // 3. Dockerコマンド構築
      const dockerArgs = [
        'run',
        '--rm',
        '-v', `${volumeName}:/repo`,
        ...authMounts,
        'alpine/git',
        'clone',
        url,
        '/repo',
      ];

      logger.info('[docker] Starting git clone', { url, volumeName, timeout });

      // 4. git clone実行
      const startTime = Date.now();
      await execFileAsync('docker', dockerArgs, { timeout });
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

      throw new GitOperationError(
        `Failed to clone repository in Docker environment`,
        'docker',
        'clone',
        true,
        error as Error
      );
    }
  }

  /**
   * worktreeを作成する
   */
  async createWorktree(options: GitWorktreeOptions): Promise<GitOperationResult> {
    const { projectId, sessionName, branchName } = options;
    const volumeName = this.getVolumeName(projectId);

    try {
      // 認証情報マウントオプション構築
      const authMounts = await this.buildAuthMounts();

      // Dockerコマンド構築
      const dockerArgs = [
        'run',
        '--rm',
        '-v', `${volumeName}:/repo`,
        ...authMounts,
        'alpine/git',
        '-C', '/repo',
        'worktree', 'add',
        `/repo/.worktrees/${sessionName}`,
        '-b', branchName,
      ];

      logger.info('[docker] Creating worktree', { projectId, sessionName, branchName });

      const startTime = Date.now();
      await execFileAsync('docker', dockerArgs, { timeout: 30000 });
      const duration = Date.now() - startTime;

      logger.info('[docker] worktree created', { projectId, sessionName, duration });

      return {
        success: true,
        message: `Worktree created successfully: ${sessionName}`,
      };
    } catch (error) {
      logger.error('[docker] Failed to create worktree', { error, projectId, sessionName });

      throw new GitOperationError(
        `Failed to create worktree in Docker environment`,
        'docker',
        'worktree',
        true,
        error as Error
      );
    }
  }

  /**
   * worktreeを削除する
   */
  async deleteWorktree(projectId: string, sessionName: string): Promise<GitOperationResult> {
    const volumeName = this.getVolumeName(projectId);

    try {
      const dockerArgs = [
        'run',
        '--rm',
        '-v', `${volumeName}:/repo`,
        'alpine/git',
        '-C', '/repo',
        'worktree', 'remove',
        `.worktrees/${sessionName}`,
      ];

      logger.info('[docker] Deleting worktree', { projectId, sessionName });

      await execFileAsync('docker', dockerArgs, { timeout: 30000 });

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
}
