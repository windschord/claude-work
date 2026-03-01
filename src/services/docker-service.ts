import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as tar from 'tar-fs';
import { logger } from '@/lib/logger';
import { DockerClient } from './docker-client';

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
  /** イメージ名（デフォルト: ghcr.io/windschord/claude-work-sandbox） */
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
  imageName: process.env.DOCKER_IMAGE_NAME || 'ghcr.io/windschord/claude-work-sandbox',
  imageTag: process.env.DOCKER_IMAGE_TAG || 'latest',
  // NaNや負の値の場合はデフォルト値5にフォールバック、最小値1を保証
  maxConcurrentContainers: Math.max(1, parseInt(process.env.DOCKER_MAX_CONTAINERS || '5', 10) || 5),
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
    return DockerClient.getInstance().ping();
  }

  /**
   * Dockerエラーを詳細に診断
   *
   * @returns DockerErrorまたはnull（問題がない場合）
   */
  async diagnoseDockerError(): Promise<DockerError | null> {
    // Dockerソケットが存在するかチェック（Dockerode経由のため、CLIではなくソケットで判定）
    const socketPath = '/var/run/docker.sock';
    const socketExists = await new Promise<boolean>((resolve) => {
      fsPromises.access(socketPath, fs.constants.F_OK)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });

    if (!socketExists) {
      return new DockerError(
        'DOCKER_NOT_INSTALLED',
        'Docker socket not found at /var/run/docker.sock',
        'Dockerがインストールされていません',
        'https://docs.docker.com/get-docker/ からDockerをインストールしてください'
      );
    }

    // Dockerデーモンが動作しているか
    try {
      await DockerClient.getInstance().info();
    } catch {
      return new DockerError(
        'DOCKER_DAEMON_NOT_RUNNING',
        'Docker daemon is not running',
        'Dockerデーモンが起動していません',
        'Docker Desktopを起動するか、`sudo systemctl start docker`を実行してください'
      );
    }

    // 権限問題のチェック
    try {
      await DockerClient.getInstance().listContainers({ limit: 1 });
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      if (err && (err.statusCode === 403 || (err.message && err.message.includes('permission denied')))) {
        return new DockerError(
          'DOCKER_PERMISSION_DENIED',
          'Docker permission denied',
          'Dockerの実行権限がありません',
          'ユーザーをdockerグループに追加してください: `sudo usermod -aG docker $USER`'
        );
      }
      // その他のエラーはここでは無視（daemon checkで弾かれてない場合）
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
    try {
      await DockerClient.getInstance().inspectImage(fullImageName);
      return true;
    } catch {
      return false;
    }
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

    const tarStream = tar.pack(dockerfilePath);
    await DockerClient.getInstance().buildImage(
      tarStream,
      {
        t: fullImageName,
      },
      (event) => {
        if (event.stream) {
          const line = event.stream.trim();
          if (line) {
            logger.debug('Docker build stdout', { line });
            if (onProgress) {
              onProgress(event.stream);
            }
          }
        }
        if (event.error) {
          logger.error('Docker build error', { error: event.error });
          // Note: DockerClient.buildImage will reject on error if we threw there, 
          // but we are just logging here. The promise rejection is handled by DockerClient.
        }
      }
    );
    logger.info('Docker image build completed', { image: fullImageName });
  }
}

/**
 * デフォルトのDockerServiceインスタンス
 * 環境変数から設定を読み込んで初期化される
 */
export const dockerService = new DockerService();
