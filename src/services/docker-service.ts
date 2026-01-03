import { exec } from 'child_process';
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
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: DockerServiceConfig = {
  imageName: process.env.DOCKER_IMAGE_NAME || 'claude-code-sandboxed',
  imageTag: process.env.DOCKER_IMAGE_TAG || 'latest',
  maxConcurrentContainers: parseInt(process.env.DOCKER_MAX_CONTAINERS || '5', 10),
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
}
