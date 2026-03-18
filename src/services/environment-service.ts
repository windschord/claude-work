import { db, schema } from '@/lib/db';
import type { ExecutionEnvironment } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
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
 * 環境削除時のVolume保持オプション
 */
export interface DeleteEnvironmentOptions {
  keepClaudeVolume?: boolean;
  keepConfigVolume?: boolean;
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
 * project_id は1対1化移行後は必須だが、後方互換のためオプションとする
 * 旧 /api/environments API が廃止（TASK-009）されたら必須化する
 * SSH は未実装のため除外している
 */
export interface CreateEnvironmentInput {
  name: string;
  type: 'HOST' | 'DOCKER';
  description?: string;
  config: object;
  project_id?: string;
}

/**
 * 環境更新入力
 * SSH は未実装のため除外している
 */
export interface UpdateEnvironmentInput {
  name?: string;
  description?: string | null;
  config?: object;
  type?: 'HOST' | 'DOCKER';
}

/**
 * サンドボックスDockerイメージのデフォルト名
 */
export const DEFAULT_SANDBOX_IMAGE_NAME = 'ghcr.io/windschord/claude-work-sandbox';

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
      project_id: input.project_id,
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
   * プロジェクトIDから環境を取得する
   *
   * まず executionEnvironments.project_id で検索する。
   * 見つからない場合は、プロジェクト作成の2フェーズ更新が中断した中間状態に備え、
   * projects.environment_id 経由でフォールバック検索する。
   *
   * @param projectId - プロジェクトID
   * @returns 環境またはnull
   */
  async findByProjectId(projectId: string): Promise<ExecutionEnvironment | null> {
    const environment = db.select().from(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.project_id, projectId))
      .get();
    if (environment) {
      return environment;
    }

    // フォールバック: projects.environment_id 経由で検索
    // プロジェクト作成の2フェーズ更新（環境作成→プロジェクト作成→project_id更新）が
    // 中断した場合、executionEnvironments.project_id が未設定のままになりうる。
    const project = db.select({ environment_id: schema.projects.environment_id })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();

    if (!project?.environment_id) {
      return null;
    }

    const fallbackEnvironment = db.select().from(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.id, project.environment_id))
      .get();

    return fallbackEnvironment ?? null;
  }

  /**
   * プロジェクト作成時に呼び出す専用メソッド
   * DOCKER環境のデフォルト設定を持つ
   * @param projectId - プロジェクトID
   * @param config - オプション設定（未指定時はデフォルトDOCKER環境を作成）
   * @returns 作成された環境
   */
  async createForProject(
    projectId: string,
    config?: Partial<CreateEnvironmentInput>
  ): Promise<ExecutionEnvironment> {
    const effectiveType = config?.type ?? 'DOCKER';

    // Docker の場合のみデフォルトのイメージ設定を適用する
    const defaultConfig = effectiveType === 'DOCKER'
      ? {
          imageName: DEFAULT_SANDBOX_IMAGE_NAME,
          imageTag: 'latest',
        }
      : {};

    return this.create({
      name: config?.name ?? `${projectId.slice(0, 8)} 環境`,
      type: effectiveType,
      description: config?.description,
      config: { ...defaultConfig, ...(config?.config ?? {}) },
      project_id: projectId,
    });
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
    if (input.type !== undefined) {
      updateData.type = input.type;
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
   * 使用中のプロジェクトがある場合は EnvironmentInUseError をスロー
   * @param id - 環境ID
   */
  async delete(id: string, options?: DeleteEnvironmentOptions): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    // トランザクション内で使用中チェックとDBレコード削除をアトミックに実行
    // TOCTOU競合を防ぐため、チェックと削除を同一トランザクションでラップする
    db.transaction((tx) => {
      // 使用中のプロジェクトを確認
      const projectsWithEnv = tx.select({ id: schema.projects.id, name: schema.projects.name })
        .from(schema.projects)
        .where(eq(schema.projects.environment_id, id))
        .all();

      if (projectsWithEnv.length > 0) {
        const projectNames = projectsWithEnv.map(p => p.name).join(', ');
        throw new EnvironmentInUseError(`この環境は以下のプロジェクトで使用中のため削除できません: ${projectNames}`);
      }

      // DBレコードを先に削除（外部リソース削除はベストエフォートで後続実施）
      tx.delete(schema.executionEnvironments)
        .where(eq(schema.executionEnvironments.id, id))
        .run();
    });

    logger.info('環境を削除しました', { id });

    // 認証ディレクトリがあれば削除（ベストエフォート）
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

    // Docker環境の場合、名前付きVolumeまたはDockerfileディレクトリを削除（ベストエフォート）
    if (environment.type === 'DOCKER' && !environment.auth_dir_path) {
      // 名前付きVolumeを直接削除（auth_dir_pathがnull = 名前付きVolume使用）
      // options で保持指定されたVolumeはスキップ
      try {
        const volumeNames = getConfigVolumeNames(id);
        const dockerClient = DockerClient.getInstance();
        if (!options?.keepClaudeVolume) {
          try {
            await dockerClient.removeVolume(volumeNames.claudeVolume);
          } catch (error) {
            logger.warn('設定Volume削除失敗', { volume: volumeNames.claudeVolume, error });
          }
        }
        if (!options?.keepConfigVolume) {
          try {
            await dockerClient.removeVolume(volumeNames.configClaudeVolume);
          } catch (error) {
            logger.warn('設定Volume削除失敗', { volume: volumeNames.configClaudeVolume, error });
          }
        }
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
      imageName = (config.buildImageName as string) || (config.imageName as string) || DEFAULT_SANDBOX_IMAGE_NAME;
      imageTag = 'latest';
    } else {
      // 既存イメージの場合
      imageName = (config.imageName as string) || DEFAULT_SANDBOX_IMAGE_NAME;
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
   * Docker環境用の設定Volumeを作成する
   * @param id - 環境ID
   */
  async createConfigVolumes(id: string): Promise<void> {
    const environment = await this.findById(id);

    if (!environment) {
      throw new Error('環境が見つかりません');
    }

    if (environment.type !== 'DOCKER') {
      throw new Error(`Docker環境でのみ実行可能です: ${environment.type}`);
    }

    const dockerClient = DockerClient.getInstance();
    const volumes = getConfigVolumeNames(id);

    await dockerClient.createVolume(volumes.claudeVolume);
    try {
      await dockerClient.createVolume(volumes.configClaudeVolume);
    } catch (error) {
      // configClaudeVolume作成失敗時、claudeVolumeをクリーンアップ
      try {
        await dockerClient.removeVolume(volumes.claudeVolume);
      } catch {
        logger.warn('部分的なVolume作成のクリーンアップに失敗しました', { volume: volumes.claudeVolume });
      }
      throw error;
    }

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

    if (environment.type !== 'DOCKER') {
      throw new Error(`Docker環境でのみ実行可能です: ${environment.type}`);
    }

    const dockerClient = DockerClient.getInstance();
    const volumes = getConfigVolumeNames(id);
    const failedVolumes: string[] = [];

    try {
      await dockerClient.removeVolume(volumes.claudeVolume);
    } catch (error) {
      failedVolumes.push(volumes.claudeVolume);
      logger.warn('設定Volume削除失敗', { volume: volumes.claudeVolume, error });
    }

    try {
      await dockerClient.removeVolume(volumes.configClaudeVolume);
    } catch (error) {
      failedVolumes.push(volumes.configClaudeVolume);
      logger.warn('設定Volume削除失敗', { volume: volumes.configClaudeVolume, error });
    }

    if (failedVolumes.length === 0) {
      logger.info('設定Volumeを全て削除しました', { id, volumes });
    } else {
      logger.warn('設定Volumeの一部削除に失敗しました', { id, failedVolumes, volumes });
    }
  }
}

/**
 * シングルトンインスタンス
 */
export const environmentService = new EnvironmentService();
