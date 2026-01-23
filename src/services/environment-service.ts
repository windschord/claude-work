import { ExecutionEnvironment } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { exec } from 'child_process';

/**
 * execをPromise化するヘルパー関数
 */
function execAsync(
  command: string,
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * 環境状態
 */
export interface EnvironmentStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
  details?: {
    dockerDaemon?: boolean;
    imageExists?: boolean;
  };
}

/**
 * 環境作成入力
 */
export interface CreateEnvironmentInput {
  name: string;
  type: 'HOST' | 'DOCKER' | 'SSH';
  description?: string;
  config: object;
}

/**
 * 環境更新入力
 */
export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  config?: object;
}

/**
 * デフォルトHOST環境の定数
 */
const DEFAULT_HOST_ENVIRONMENT = {
  id: 'host-default',
  name: 'Local Host',
  type: 'HOST',
  description: 'デフォルトのホスト環境',
  config: '{}',
  is_default: true,
} as const;

/**
 * EnvironmentService
 * 実行環境のCRUD操作と状態管理
 */
export class EnvironmentService {
  /**
   * 認証ディレクトリのベースパス
   */
  private getAuthBasePath(): string {
    return path.resolve(process.cwd(), 'data', 'environments');
  }

  /**
   * 環境を作成する
   * @param input - 環境作成入力
   * @returns 作成された環境
   */
  async create(input: CreateEnvironmentInput): Promise<ExecutionEnvironment> {
    const configJson = JSON.stringify(input.config);

    logger.info('環境を作成中', { name: input.name, type: input.type });

    const environment = await prisma.executionEnvironment.create({
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        config: configJson,
        is_default: false,
      },
    });

    logger.info('環境を作成しました', { id: environment.id, name: environment.name });

    return environment;
  }

  /**
   * IDで環境を取得する
   * @param id - 環境ID
   * @returns 環境またはnull
   */
  async findById(id: string): Promise<ExecutionEnvironment | null> {
    return prisma.executionEnvironment.findUnique({
      where: { id },
    });
  }

  /**
   * 全ての環境を取得する
   * @returns 環境の配列
   */
  async findAll(): Promise<ExecutionEnvironment[]> {
    return prisma.executionEnvironment.findMany({
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * 環境を更新する
   * @param id - 環境ID
   * @param input - 更新入力
   * @returns 更新された環境
   */
  async update(id: string, input: UpdateEnvironmentInput): Promise<ExecutionEnvironment> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.config !== undefined) {
      updateData.config = JSON.stringify(input.config);
    }

    logger.info('環境を更新中', { id, updates: Object.keys(updateData) });

    const environment = await prisma.executionEnvironment.update({
      where: { id },
      data: updateData,
    });

    logger.info('環境を更新しました', { id: environment.id });

    return environment;
  }

  /**
   * 環境を削除する
   * デフォルト環境は削除不可
   * 使用中のセッションがある場合は警告をログに出力（削除は許可）
   * @param id - 環境ID
   */
  async delete(id: string): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    if (environment.is_default) {
      throw new Error('デフォルト環境は削除できません');
    }

    // 使用中のセッション数を確認
    const sessionCount = await prisma.session.count({
      where: { environment_id: id },
    });

    if (sessionCount > 0) {
      logger.warn('使用中のセッションがある環境を削除します', {
        environmentId: id,
        sessionCount,
      });
    }

    // 認証ディレクトリがあれば削除
    if (environment.auth_dir_path) {
      try {
        await fsPromises.rm(environment.auth_dir_path, { recursive: true, force: true });
        logger.info('認証ディレクトリを削除しました', { path: environment.auth_dir_path });
      } catch (error) {
        logger.warn('認証ディレクトリの削除に失敗しました', {
          path: environment.auth_dir_path,
          error,
        });
      }
    }

    await prisma.executionEnvironment.delete({
      where: { id },
    });

    logger.info('環境を削除しました', { id });
  }

  /**
   * デフォルト環境を取得する
   * @returns デフォルト環境
   * @throws デフォルト環境が見つからない場合
   */
  async getDefault(): Promise<ExecutionEnvironment> {
    const environment = await prisma.executionEnvironment.findFirst({
      where: { is_default: true },
    });

    if (!environment) {
      throw new Error('デフォルト環境が見つかりません');
    }

    return environment;
  }

  /**
   * デフォルト環境が存在しない場合に作成する
   */
  async ensureDefaultExists(): Promise<void> {
    const existing = await prisma.executionEnvironment.findFirst({
      where: { is_default: true },
    });

    if (existing) {
      logger.debug('デフォルト環境は既に存在します', { id: existing.id });
      return;
    }

    await prisma.executionEnvironment.create({
      data: {
        id: DEFAULT_HOST_ENVIRONMENT.id,
        name: DEFAULT_HOST_ENVIRONMENT.name,
        type: DEFAULT_HOST_ENVIRONMENT.type,
        description: DEFAULT_HOST_ENVIRONMENT.description,
        config: DEFAULT_HOST_ENVIRONMENT.config,
        is_default: DEFAULT_HOST_ENVIRONMENT.is_default,
      },
    });

    logger.info('デフォルト環境を作成しました', { id: DEFAULT_HOST_ENVIRONMENT.id });
  }

  /**
   * 環境の状態をチェックする
   * Docker環境用の詳細チェックは後で実装
   * @param id - 環境ID
   * @returns 環境状態
   */
  async checkStatus(id: string): Promise<EnvironmentStatus> {
    const environment = await this.findById(id);

    if (!environment) {
      return {
        available: false,
        authenticated: false,
        error: '環境が見つかりません',
      };
    }

    switch (environment.type) {
      case 'HOST':
        // HOSTは常に利用可能
        return {
          available: true,
          authenticated: true,
        };

      case 'DOCKER': {
        // Docker環境の詳細チェック
        const dockerStatus = await this.checkDockerStatus(environment);
        return dockerStatus;
      }

      case 'SSH':
        // SSH環境のチェックは将来実装
        return {
          available: false,
          authenticated: false,
          error: 'SSH環境は未実装です',
        };

      default:
        return {
          available: false,
          authenticated: false,
          error: `不明な環境タイプ: ${environment.type}`,
        };
    }
  }

  /**
   * Docker環境の詳細ステータスをチェック
   * @param environment - 環境エンティティ
   * @returns Docker環境のステータス
   */
  private async checkDockerStatus(environment: ExecutionEnvironment): Promise<EnvironmentStatus> {
    let dockerDaemon = false;
    let imageExists = false;

    // Dockerデーモンのチェック
    try {
      await execAsync('docker info', { timeout: 5000 });
      dockerDaemon = true;
    } catch {
      logger.debug('Dockerデーモンが起動していません', { environmentId: environment.id });
      return {
        available: false,
        authenticated: false,
        error: 'Dockerデーモンが起動していません',
        details: {
          dockerDaemon: false,
          imageExists: false,
        },
      };
    }

    // イメージの存在チェック
    const config = JSON.parse(environment.config || '{}');
    let imageName: string;
    let imageTag: string;

    if (config.imageSource === 'dockerfile') {
      // Dockerfileビルドの場合はビルド後のイメージ名を使用
      imageName = config.buildImageName || config.imageName || 'claude-code-sandboxed';
      imageTag = 'latest';
    } else {
      // 既存イメージの場合
      imageName = config.imageName || 'claude-code-sandboxed';
      imageTag = config.imageTag || 'latest';
    }

    const fullImageName = `${imageName}:${imageTag}`;

    try {
      await execAsync(`docker image inspect ${fullImageName}`, { timeout: 5000 });
      imageExists = true;
    } catch {
      const errorMsg =
        config.imageSource === 'dockerfile'
          ? 'ビルド済みイメージが見つかりません。環境を再作成してビルドしてください。'
          : `イメージ ${fullImageName} が見つかりません。docker pullまたはビルドしてください。`;

      logger.debug('Dockerイメージが見つかりません', {
        environmentId: environment.id,
        imageName: fullImageName,
      });

      return {
        available: false,
        authenticated: !!environment.auth_dir_path,
        error: errorMsg,
        details: { dockerDaemon: true, imageExists: false },
      };
    }

    return {
      available: dockerDaemon && imageExists,
      authenticated: !!environment.auth_dir_path,
      details: {
        dockerDaemon,
        imageExists,
      },
    };
  }

  /**
   * Docker環境用の認証ディレクトリを作成する
   * TASK-EE-003で詳細実装
   * @param id - 環境ID
   * @returns 作成されたディレクトリのパス
   */
  async createAuthDirectory(id: string): Promise<string> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    const authDirPath = path.join(this.getAuthBasePath(), id);

    await fsPromises.mkdir(authDirPath, { recursive: true });

    await prisma.executionEnvironment.update({
      where: { id },
      data: { auth_dir_path: authDirPath },
    });

    logger.info('認証ディレクトリを作成しました', { id, path: authDirPath });

    return authDirPath;
  }

  /**
   * Docker環境用の認証ディレクトリを削除する
   * TASK-EE-003で詳細実装
   * @param id - 環境ID
   */
  async deleteAuthDirectory(id: string): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    if (!environment.auth_dir_path) {
      logger.debug('認証ディレクトリが設定されていません', { id });
      return;
    }

    await fsPromises.rm(environment.auth_dir_path, { recursive: true, force: true });

    await prisma.executionEnvironment.update({
      where: { id },
      data: { auth_dir_path: null },
    });

    logger.info('認証ディレクトリを削除しました', { id, path: environment.auth_dir_path });
  }
}

/**
 * シングルトンインスタンス
 */
export const environmentService = new EnvironmentService();
