import { db, schema } from '@/lib/db';
import type { ExecutionEnvironment } from '@/lib/db';
import { eq, asc, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';
import { isHostEnvironmentAllowed } from '@/lib/environment-detect';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { DockerClient } from './docker-client';
import { getConfigVolumeNames } from '@/lib/docker-volume-utils';

/**
 * 環境が使用中のため削除できないことを示すエラー
 */
export class EnvironmentInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentInUseError';
  }
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
 * デフォルトDocker環境の定数
 */
const DEFAULT_DOCKER_ENVIRONMENT = {
  id: 'docker-default',
  name: 'Default Docker',
  type: 'DOCKER',
  description: 'デフォルトのDocker環境',
  config: JSON.stringify({
    imageName: 'claude-code-sandboxed',
    imageTag: 'latest',
  }),
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
    return getEnvironmentsDir();
  }

  /**
   * 環境を作成する
   * @param input - 環境作成入力
   * @returns 作成された環境
   */
  async create(input: CreateEnvironmentInput): Promise<ExecutionEnvironment> {
    if (input.type === 'HOST' && !isHostEnvironmentAllowed()) {
      throw new Error('HOST環境はこの環境では作成できません');
    }

    const configJson = JSON.stringify(input.config);

    logger.info('環境を作成中', { name: input.name, type: input.type });

    const environment = db.insert(schema.executionEnvironments).values({
      name: input.name,
      type: input.type,
      description: input.description,
      config: configJson,
      is_default: false,
    }).returning().get();

    if (!environment) {
      throw new Error('Failed to create environment');
    }

    logger.info('環境を作成しました', { id: environment.id, name: environment.name });

    return environment;
  }

  /**
   * IDで環境を取得する
   * @param id - 環境ID
   * @returns 環境またはnull
   */
  async findById(id: string): Promise<ExecutionEnvironment | null> {
    const environment = db.select().from(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.id, id))
      .get();
    return environment || null;
  }

  /**
   * 全ての環境を取得する
   * @returns 環境の配列
   */
  async findAll(): Promise<ExecutionEnvironment[]> {
    return db.select().from(schema.executionEnvironments)
      .orderBy(asc(schema.executionEnvironments.created_at))
      .all();
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

    // updated_at を常に更新
    updateData.updated_at = new Date();

    logger.info('環境を更新中', { id, updates: Object.keys(updateData) });

    const environment = db.update(schema.executionEnvironments)
      .set(updateData)
      .where(eq(schema.executionEnvironments.id, id))
      .returning()
      .get();

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    logger.info('環境を更新しました', { id: environment.id });

    return environment;
  }

  /**
   * 環境を削除する
   * デフォルト環境は削除不可
   * 使用中のプロジェクトがある場合は削除を拒否
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

    // 使用中のプロジェクトを確認
    const projectsWithEnv = db.select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.environment_id, id))
      .all();

    if (projectsWithEnv.length > 0) {
      const projectNames = projectsWithEnv.map(p => p.name).join(', ');
      throw new EnvironmentInUseError(`この環境は以下のプロジェクトで使用中のため削除できません: ${projectNames}`);
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

    // Docker環境の場合、名前付きVolumeまたはDockerfileディレクトリを削除
    if (environment.type === 'DOCKER' && !environment.auth_dir_path) {
      // 名前付きVolumeを削除（auth_dir_pathがnull = 名前付きVolume使用）
      try {
        await this.deleteConfigVolumes(id);
      } catch (error) {
        logger.warn('設定Volumeの削除に失敗しました', { environmentId: id, error });
      }

      // auth_dir_pathが未設定の場合でもDockerfileが存在する可能性がある
      const envDir = path.join(this.getAuthBasePath(), id);
      try {
        await fsPromises.rm(envDir, { recursive: true, force: true });
        logger.info('環境ディレクトリを削除しました', { path: envDir });
      } catch (error) {
        // ディレクトリが存在しなくてもOK
        logger.debug('環境ディレクトリの削除をスキップしました', { path: envDir, error });
      }
    }

    // セッションのenvironment_id NULLクリアと環境レコード削除をトランザクションで実行
    db.transaction((tx) => {
      tx.update(schema.sessions)
        .set({ environment_id: null })
        .where(eq(schema.sessions.environment_id, id))
        .run();

      tx.delete(schema.executionEnvironments)
        .where(eq(schema.executionEnvironments.id, id))
        .run();
    });

    logger.info('環境を削除しました', { id });
  }

  /**
   * デフォルト環境を取得する
   * @returns デフォルト環境
   * @throws デフォルト環境が見つからない場合
   */
  async getDefault(): Promise<ExecutionEnvironment> {
    const environment = db.select().from(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.is_default, true))
      .get();

    if (!environment) {
      throw new Error('デフォルト環境が見つかりません');
    }

    return environment;
  }

  /**
   * デフォルト環境が存在しない場合に作成する
   */
  async ensureDefaultExists(): Promise<void> {
    if (!isHostEnvironmentAllowed()) {
      // Docker内動作: デフォルトDocker環境を作成
      await this.ensureDefaultEnvironment();
      return;
    }

    const existing = db.select().from(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.is_default, true))
      .get();

    if (existing) {
      logger.debug('デフォルト環境は既に存在します', { id: existing.id });
      return;
    }

    db.insert(schema.executionEnvironments).values({
      id: DEFAULT_HOST_ENVIRONMENT.id,
      name: DEFAULT_HOST_ENVIRONMENT.name,
      type: DEFAULT_HOST_ENVIRONMENT.type,
      description: DEFAULT_HOST_ENVIRONMENT.description,
      config: DEFAULT_HOST_ENVIRONMENT.config,
      is_default: DEFAULT_HOST_ENVIRONMENT.is_default,
    }).run();

    logger.info('デフォルト環境を作成しました', { id: DEFAULT_HOST_ENVIRONMENT.id });
  }

  /**
   * デフォルトDocker環境を取得または作成する
   * @returns デフォルトDocker環境
   */
  async ensureDefaultEnvironment(): Promise<ExecutionEnvironment> {
    // is_default=trueのDocker環境のみを検索
    const existing = db.select().from(schema.executionEnvironments)
      .where(and(
        eq(schema.executionEnvironments.type, 'DOCKER'),
        eq(schema.executionEnvironments.is_default, true)
      ))
      .get();

    if (existing) {
      logger.debug('デフォルトDocker環境は既に存在します', { id: existing.id });
      return existing;
    }

    // 既存のデフォルト環境をis_default=falseに更新してから新規作成（トランザクションで保護）
    const environment = db.transaction((tx) => {
      tx.update(schema.executionEnvironments)
        .set({ is_default: false })
        .where(eq(schema.executionEnvironments.is_default, true))
        .run();

      return tx.insert(schema.executionEnvironments).values({
        id: DEFAULT_DOCKER_ENVIRONMENT.id,
        name: DEFAULT_DOCKER_ENVIRONMENT.name,
        type: DEFAULT_DOCKER_ENVIRONMENT.type,
        description: DEFAULT_DOCKER_ENVIRONMENT.description,
        config: DEFAULT_DOCKER_ENVIRONMENT.config,
        is_default: DEFAULT_DOCKER_ENVIRONMENT.is_default,
      }).returning().get();
    });

    if (!environment) {
      throw new Error('Failed to create default Docker environment');
    }

    logger.info('デフォルトDocker環境を作成しました', { id: environment.id, name: environment.name });

    return environment;
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
        if (!isHostEnvironmentAllowed()) {
          return {
            available: false,
            authenticated: false,
            error: 'Docker環境内ではHOST環境は利用できません',
          };
        }
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
    const dockerClient = DockerClient.getInstance();
    let imageExists = false;

    // Dockerデーモンのチェック
    try {
      await dockerClient.info();
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
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(environment.config || '{}');
    } catch {
      logger.warn('Invalid config JSON in environment', { environmentId: environment.id });
      // 破損データでもステータスAPIが落ちないようにデフォルト値を使用
    }
    let imageName: string;
    let imageTag: string;

    if (config.imageSource === 'dockerfile') {
      // Dockerfileビルドの場合はビルド後のイメージ名を使用
      imageName = (config.buildImageName as string) || (config.imageName as string) || 'claude-code-sandboxed';
      imageTag = 'latest';
    } else {
      // 既存イメージの場合
      imageName = (config.imageName as string) || 'claude-code-sandboxed';
      imageTag = (config.imageTag as string) || 'latest';
    }

    const fullImageName = `${imageName}:${imageTag}`;

    try {
      await dockerClient.inspectImage(fullImageName);
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
        authenticated: !!environment.auth_dir_path || environment.type === 'DOCKER',
        error: errorMsg,
        details: { dockerDaemon: true, imageExists: false },
      };
    }

    return {
      // imageExistsのみチェック（docker infoが成功していればデーモンは稼働中）
      available: imageExists,
      authenticated: !!environment.auth_dir_path || environment.type === 'DOCKER',
      details: {
        dockerDaemon: true, // docker infoが成功したのでtrue
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

    // 認証ディレクトリとサブディレクトリを適切なパーミッションで作成
    await fsPromises.mkdir(authDirPath, { recursive: true, mode: 0o700 });
    await fsPromises.mkdir(path.join(authDirPath, 'claude'), { recursive: true, mode: 0o700 });
    await fsPromises.mkdir(path.join(authDirPath, 'config', 'claude'), { recursive: true, mode: 0o700 });

    db.update(schema.executionEnvironments)
      .set({ auth_dir_path: authDirPath, updated_at: new Date() })
      .where(eq(schema.executionEnvironments.id, id))
      .run();

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

    db.update(schema.executionEnvironments)
      .set({ auth_dir_path: null, updated_at: new Date() })
      .where(eq(schema.executionEnvironments.id, id))
      .run();

    logger.info('認証ディレクトリを削除しました', { id, path: environment.auth_dir_path });
  }

  /**
   * 環境IDからDocker名前付きVolumeの名前を取得する
   * @see getConfigVolumeNames (src/lib/docker-volume-utils.ts)
   */
  private getConfigVolumeNames(environmentId: string): { claudeVolume: string; configClaudeVolume: string } {
    return getConfigVolumeNames(environmentId);
  }

  /**
   * Docker環境用の設定Volumeを作成する
   * @param id - 環境ID
   */
  async createConfigVolumes(id: string): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    const dockerClient = DockerClient.getInstance();
    const volumes = this.getConfigVolumeNames(id);

    await dockerClient.createVolume(volumes.claudeVolume);
    await dockerClient.createVolume(volumes.configClaudeVolume);

    logger.info('設定Volumeを作成しました', { id, volumes });
  }

  /**
   * Docker環境用の設定Volumeを削除する
   * @param id - 環境ID
   */
  async deleteConfigVolumes(id: string): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    const dockerClient = DockerClient.getInstance();
    const volumes = this.getConfigVolumeNames(id);

    try {
      await dockerClient.removeVolume(volumes.claudeVolume);
    } catch (error) {
      logger.warn('設定Volume削除失敗', { volume: volumes.claudeVolume, error });
    }

    try {
      await dockerClient.removeVolume(volumes.configClaudeVolume);
    } catch (error) {
      logger.warn('設定Volume削除失敗', { volume: volumes.configClaudeVolume, error });
    }

    logger.info('設定Volumeを削除しました', { id, volumes });
  }
}

/**
 * シングルトンインスタンス
 */
export const environmentService = new EnvironmentService();
