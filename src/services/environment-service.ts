import { db, schema } from '@/lib/db';
import type { ExecutionEnvironment } from '@/lib/db';
import { eq, asc, count, sql, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { spawn } from 'child_process';

/**
 * spawnをPromise化するヘルパー関数（コマンドインジェクション対策）
 * 引数を配列で渡すことでシェル経由の実行を避ける
 */
function spawnAsync(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // タイムアウト設定
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, options.timeout);
    }

    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
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

    // 使用中のセッション数を確認（この環境を使用しているプロジェクトのセッション数）
    const projectsWithEnv = db.select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.environment_id, id))
      .all();
    const projectIds = projectsWithEnv.map((p) => p.id);
    let sessionCount = 0;
    if (projectIds.length > 0) {
      const result = db.select({ count: count() })
        .from(schema.sessions)
        .where(
          // プロジェクトIDがprojectIdsのいずれかに一致するセッション
          projectIds.length === 1
            ? eq(schema.sessions.project_id, projectIds[0])
            : sql`${schema.sessions.project_id} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`
        )
        .get();
      sessionCount = result?.count ?? 0;
    }

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

    // Docker環境の場合、Dockerfileがあれば削除
    // (auth_dir_pathと同じディレクトリにDockerfileが保存されている場合は上記で削除済み)
    if (environment.type === 'DOCKER' && !environment.auth_dir_path) {
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

    db.delete(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.id, id))
      .run();

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

    // 既存のデフォルト環境をis_default=falseに更新してから新規作成
    db.update(schema.executionEnvironments)
      .set({ is_default: false })
      .where(eq(schema.executionEnvironments.is_default, true))
      .run();

    // Docker環境を作成
    const environment = db.insert(schema.executionEnvironments).values({
      id: DEFAULT_DOCKER_ENVIRONMENT.id,
      name: DEFAULT_DOCKER_ENVIRONMENT.name,
      type: DEFAULT_DOCKER_ENVIRONMENT.type,
      description: DEFAULT_DOCKER_ENVIRONMENT.description,
      config: DEFAULT_DOCKER_ENVIRONMENT.config,
      is_default: DEFAULT_DOCKER_ENVIRONMENT.is_default,
    }).returning().get();

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
    let imageExists = false;

    // Dockerデーモンのチェック（spawnAsyncでコマンドインジェクション対策）
    try {
      await spawnAsync('docker', ['info'], { timeout: 5000 });
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
      // spawnAsyncで引数を配列で渡すことでコマンドインジェクションを防止
      await spawnAsync('docker', ['image', 'inspect', fullImageName], { timeout: 5000 });
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
      // imageExistsのみチェック（docker infoが成功していればデーモンは稼働中）
      available: imageExists,
      authenticated: !!environment.auth_dir_path,
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
}

/**
 * シングルトンインスタンス
 */
export const environmentService = new EnvironmentService();
