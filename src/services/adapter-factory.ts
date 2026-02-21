import { EnvironmentAdapter } from './environment-adapter';
import { HostAdapter } from './adapters/host-adapter';
import { DockerAdapter, DockerAdapterConfig } from './adapters/docker-adapter';
import type { ExecutionEnvironment } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { DockerEnvironmentConfig } from '@/types/environment';

/**
 * AdapterFactory
 *
 * ExecutionEnvironmentに応じた適切なEnvironmentAdapterを返すファクトリ。
 *
 * - HostAdapterはグローバルシングルトン
 * - DockerAdapterは環境IDごとにシングルトン
 * - SSHは将来実装予定（現在はエラー）
 */
export class AdapterFactory {
  private static hostAdapter: HostAdapter | null = null;
  private static dockerAdapters: Map<string, DockerAdapter> = new Map();

  /**
   * 環境に応じたアダプターを取得
   */
  static getAdapter(environment: ExecutionEnvironment): EnvironmentAdapter {
    switch (environment.type) {
      case 'HOST':
        return this.getHostAdapter();

      case 'DOCKER':
        return this.getDockerAdapter(environment);

      case 'SSH':
        throw new Error('SSH adapter is not yet implemented');

      default:
        throw new Error(`Unknown environment type: ${environment.type}`);
    }
  }

  /**
   * HostAdapterを取得（シングルトン）
   */
  private static getHostAdapter(): HostAdapter {
    if (!this.hostAdapter) {
      logger.info('AdapterFactory: Creating HostAdapter singleton');
      this.hostAdapter = new HostAdapter();
    }
    return this.hostAdapter;
  }

  /**
   * DockerAdapterを取得（環境IDごとにシングルトン）
   */
  private static getDockerAdapter(environment: ExecutionEnvironment): DockerAdapter {
    const existingAdapter = this.dockerAdapters.get(environment.id);
    if (existingAdapter) {
      return existingAdapter;
    }

    // configからイメージ情報を取得
    let configData: DockerEnvironmentConfig = {};
    try {
      configData = JSON.parse(environment.config || '{}');
    } catch {
      logger.warn('AdapterFactory: Invalid config JSON, using defaults', {
        environmentId: environment.id,
      });
    }

    // authDirPathが未設定の場合はエラー（Docker環境には認証ディレクトリが必須）
    if (!environment.auth_dir_path) {
      throw new Error(`Docker environment ${environment.id} is missing auth_dir_path. Please recreate the environment.`);
    }

    const config: DockerAdapterConfig = {
      environmentId: environment.id,
      imageName: configData.imageName || 'claude-code-sandboxed',
      imageTag: configData.imageTag || 'latest',
      authDirPath: environment.auth_dir_path,
    };

    logger.info('AdapterFactory: Creating DockerAdapter', {
      environmentId: environment.id,
      imageName: config.imageName,
      imageTag: config.imageTag,
    });

    const adapter = new DockerAdapter(config);
    this.dockerAdapters.set(environment.id, adapter);
    return adapter;
  }

  /**
   * キャッシュされたDockerAdapterを削除
   */
  static removeDockerAdapter(environmentId: string): void {
    if (this.dockerAdapters.has(environmentId)) {
      logger.info('AdapterFactory: Removing DockerAdapter', { environmentId });
      this.dockerAdapters.delete(environmentId);
    }
  }

  /**
   * 登録されているDockerAdapterの数を取得
   */
  static getDockerAdapterCount(): number {
    return this.dockerAdapters.size;
  }

  /**
   * 全てのアダプターをリセット（テスト用）
   */
  static reset(): void {
    logger.info('AdapterFactory: Resetting all adapters');
    this.hostAdapter = null;
    this.dockerAdapters.clear();
  }
}
