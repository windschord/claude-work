import { exec, execFile, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { logger } from '@/lib/logger';

/**
 * Dockerエラータイプ
 */
export type DockerErrorType =
  | 'DOCKER_NOT_INSTALLED'
  | 'DOCKER_DAEMON_NOT_RUNNING'
  | 'DOCKER_IMAGE_NOT_FOUND'
  | 'DOCKER_IMAGE_BUILD_FAILED'
  | 'DOCKER_CONTAINER_START_FAILED'
  | 'DOCKER_PERMISSION_DENIED'
  | 'CLAUDE_AUTH_MISSING'
  | 'GIT_AUTH_MISSING'
  | 'API_KEY_MISSING'
  | 'UNKNOWN';

/**
 * Dockerエラー
 */
export class DockerError extends Error {
  readonly errorType: DockerErrorType;
  readonly userMessage: string;
  readonly suggestion: string;

  constructor(
    errorType: DockerErrorType,
    message: string,
    userMessage: string,
    suggestion: string
  ) {
    super(message);
    this.name = 'DockerError';
    this.errorType = errorType;
    this.userMessage = userMessage;
    this.suggestion = suggestion;
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   */
  toUserString(): string {
    return `${this.userMessage}\n提案: ${this.suggestion}`;
  }
}

/**
 * 認証情報チェック結果
 */
export interface AuthCredentialsCheck {
  claudeAuth: {
    exists: boolean;
    path: string;
  };
  claudeConfig: {
    exists: boolean;
    path: string;
  };
  sshAuth: {
    exists: boolean;
    path: string;
  };
  gitConfig: {
    exists: boolean;
    path: string;
  };
  anthropicApiKey: {
    exists: boolean;
  };
}

/**
 * DockerService設定
 */
export interface DockerServiceConfig {
  /** イメージ名（デフォルト: claude-code-sandboxed） */
  imageName: string;
  /** イメージタグ（デフォルト: latest） */
  imageTag: string;
  /** 同時実行可能なコンテナ数上限（デフォルト: 5） */
  maxConcurrentContainers: number;
  /** Docker機能の有効/無効（デフォルト: true） */
  enabled: boolean;
}

/**
 * デフォルト設定
 * Docker機能はデフォルトで無効。有効にするにはDOCKER_ENABLED=trueを設定。
 */
const DEFAULT_CONFIG: DockerServiceConfig = {
  imageName: process.env.DOCKER_IMAGE_NAME || 'claude-code-sandboxed',
  imageTag: process.env.DOCKER_IMAGE_TAG || 'latest',
  maxConcurrentContainers: parseInt(process.env.DOCKER_MAX_CONTAINERS || '5', 10),
  enabled: process.env.DOCKER_ENABLED === 'true',
};

/**
 * DockerService
 *
 * Docker CLIのラッパーサービス。
 * Dockerデーモンの可用性チェック、イメージ管理、コンテナ操作を提供。
 */
export class DockerService {
  private config: DockerServiceConfig;

  constructor(config?: Partial<DockerServiceConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * イメージ名を取得
   */
  getImageName(): string {
    return this.config.imageName;
  }

  /**
   * イメージタグを取得
   */
  getImageTag(): string {
    return this.config.imageTag;
  }

  /**
   * 完全なイメージ名（name:tag）を取得
   */
  getFullImageName(): string {
    return `${this.config.imageName}:${this.config.imageTag}`;
  }

  /**
   * 同時実行可能なコンテナ数上限を取得
   */
  getMaxConcurrentContainers(): number {
    return this.config.maxConcurrentContainers;
  }

  /**
   * Docker機能が有効かどうかを取得
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Dockerデーモンが利用可能かチェック
   *
   * @returns Dockerが利用可能な場合はtrue
   */
  async isDockerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('docker info', (error) => {
        if (error) {
          logger.debug('Docker is not available', { error: error.message });
          resolve(false);
        } else {
          logger.debug('Docker is available');
          resolve(true);
        }
      });
    });
  }

  /**
   * Dockerエラーを詳細に診断
   *
   * @returns DockerErrorまたはnull（問題がない場合）
   */
  async diagnoseDockerError(): Promise<DockerError | null> {
    // Dockerコマンドが存在するか
    const dockerInstalled = await new Promise<boolean>((resolve) => {
      exec('which docker', (error) => {
        resolve(!error);
      });
    });

    if (!dockerInstalled) {
      return new DockerError(
        'DOCKER_NOT_INSTALLED',
        'Docker command not found',
        'Dockerがインストールされていません',
        'https://docs.docker.com/get-docker/ からDockerをインストールしてください'
      );
    }

    // Dockerデーモンが動作しているか
    const daemonRunning = await new Promise<boolean>((resolve) => {
      exec('docker info', (error) => {
        resolve(!error);
      });
    });

    if (!daemonRunning) {
      return new DockerError(
        'DOCKER_DAEMON_NOT_RUNNING',
        'Docker daemon is not running',
        'Dockerデーモンが起動していません',
        'Docker Desktopを起動するか、`sudo systemctl start docker`を実行してください'
      );
    }

    // 権限問題のチェック
    const hasPermission = await new Promise<boolean>((resolve) => {
      exec('docker ps', (error) => {
        if (error && error.message.includes('permission denied')) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    if (!hasPermission) {
      return new DockerError(
        'DOCKER_PERMISSION_DENIED',
        'Docker permission denied',
        'Dockerの実行権限がありません',
        'ユーザーをdockerグループに追加してください: `sudo usermod -aG docker $USER`'
      );
    }

    return null;
  }

  /**
   * 認証情報の存在をチェック
   *
   * @returns 認証情報のチェック結果
   */
  async checkAuthCredentials(): Promise<AuthCredentialsCheck> {
    const homeDir = os.homedir();

    const claudeAuthPath = path.join(homeDir, '.claude');
    const claudeConfigPath = path.join(homeDir, '.config', 'claude');
    const sshPath = path.join(homeDir, '.ssh');
    const gitConfigPath = path.join(homeDir, '.gitconfig');

    // 非同期で各パスの存在をチェック
    const checkExists = async (filePath: string): Promise<boolean> => {
      try {
        await fsPromises.access(filePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };

    const [claudeAuthExists, claudeConfigExists, sshExists, gitConfigExists] = await Promise.all([
      checkExists(claudeAuthPath),
      checkExists(claudeConfigPath),
      checkExists(sshPath),
      checkExists(gitConfigPath),
    ]);

    const result: AuthCredentialsCheck = {
      claudeAuth: {
        exists: claudeAuthExists,
        path: claudeAuthPath,
      },
      claudeConfig: {
        exists: claudeConfigExists,
        path: claudeConfigPath,
      },
      sshAuth: {
        exists: sshExists,
        path: sshPath,
      },
      gitConfig: {
        exists: gitConfigExists,
        path: gitConfigPath,
      },
      anthropicApiKey: {
        exists: !!process.env.ANTHROPIC_API_KEY,
      },
    };

    logger.debug('Auth credentials check', result);
    return result;
  }

  /**
   * 認証情報の問題を診断
   *
   * @returns エラーメッセージ配列（問題がなければ空配列）
   */
  async diagnoseAuthIssues(): Promise<string[]> {
    const issues: string[] = [];
    const auth = await this.checkAuthCredentials();

    if (!auth.claudeAuth.exists && !auth.claudeConfig.exists) {
      issues.push('Claude認証情報が見つかりません。先にClaude Codeでログインしてください。');
    }

    if (!auth.anthropicApiKey.exists) {
      issues.push('ANTHROPIC_API_KEY環境変数が設定されていません。');
    }

    return issues;
  }

  /**
   * Dockerイメージが存在するかチェック
   *
   * @returns イメージが存在する場合はtrue
   */
  async imageExists(): Promise<boolean> {
    const fullImageName = this.getFullImageName();

    return new Promise((resolve) => {
      // execFileを使用してコマンドインジェクションを防止
      execFile('docker', ['images', '-q', fullImageName], (error, stdout) => {
        if (error) {
          logger.debug('Failed to check Docker image', { error: error.message });
          resolve(false);
        } else {
          const exists = stdout.trim().length > 0;
          logger.debug('Docker image check', { image: fullImageName, exists });
          resolve(exists);
        }
      });
    });
  }

  /**
   * Dockerfileのパスを取得
   *
   * @returns Dockerfileディレクトリのパス
   */
  getDockerfilePath(): string {
    // プロジェクトルートからの相対パス
    return path.resolve(process.cwd(), 'docker');
  }

  /**
   * Dockerイメージをビルド
   *
   * @param onProgress - 進捗コールバック（各行のログを受け取る）
   * @returns ビルド完了時にresolve、失敗時にreject
   */
  async buildImage(onProgress?: (line: string) => void): Promise<void> {
    const fullImageName = this.getFullImageName();
    const dockerfilePath = this.getDockerfilePath();

    logger.info('Starting Docker image build', { image: fullImageName, path: dockerfilePath });

    return new Promise((resolve, reject) => {
      const buildProcess = spawn('docker', ['build', '-t', fullImageName, dockerfilePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 標準出力を処理
      buildProcess.stdout.on('data', (data: Buffer) => {
        const line = data.toString();
        logger.debug('Docker build stdout', { line: line.trim() });
        if (onProgress) {
          onProgress(line);
        }
      });

      // 標準エラー出力を処理
      buildProcess.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        logger.debug('Docker build stderr', { line: line.trim() });
        if (onProgress) {
          onProgress(line);
        }
      });

      // プロセス終了時の処理
      buildProcess.on('close', (exitCode) => {
        if (exitCode === 0) {
          logger.info('Docker image build completed', { image: fullImageName });
          resolve();
        } else {
          const error = new Error(`Docker image build failed with exit code ${exitCode}`);
          logger.error('Docker image build failed', { image: fullImageName, exitCode });
          reject(error);
        }
      });

      // エラー発生時の処理
      buildProcess.on('error', (error) => {
        logger.error('Docker build process error', { error: error.message });
        reject(error);
      });
    });
  }
}

/**
 * デフォルトのDockerServiceインスタンス
 * 環境変数から設定を読み込んで初期化される
 */
export const dockerService = new DockerService();
