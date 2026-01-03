import { exec, spawn } from 'child_process';
import * as path from 'path';
import { logger } from '@/lib/logger';

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
 */
const DEFAULT_CONFIG: DockerServiceConfig = {
  imageName: process.env.DOCKER_IMAGE_NAME || 'claude-code-sandboxed',
  imageTag: process.env.DOCKER_IMAGE_TAG || 'latest',
  maxConcurrentContainers: parseInt(process.env.DOCKER_MAX_CONTAINERS || '5', 10),
  enabled: process.env.DOCKER_ENABLED !== 'false',
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
   * Dockerイメージが存在するかチェック
   *
   * @returns イメージが存在する場合はtrue
   */
  async imageExists(): Promise<boolean> {
    const fullImageName = this.getFullImageName();

    return new Promise((resolve) => {
      exec(`docker images -q ${fullImageName}`, (error, stdout) => {
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
