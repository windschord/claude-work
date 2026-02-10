import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { environmentService } from '@/services/environment-service';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';

// 許可されたベースディレクトリ
const ALLOWED_BASE_DIRS = [
  getEnvironmentsDir(),
];

// ファイル名のバリデーション正規表現
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_FILENAME_LENGTH = 255;

/**
 * パスが許可されたベースディレクトリ配下かどうかを検証
 */
function isPathAllowed(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  return ALLOWED_BASE_DIRS.some(baseDir => resolvedPath.startsWith(baseDir + path.sep));
}

/**
 * ファイル名が安全かどうかを検証
 */
function isSafeFilename(filename: string): boolean {
  if (!filename || filename.length > MAX_FILENAME_LENGTH) {
    return false;
  }
  return SAFE_FILENAME_PATTERN.test(filename);
}

const VALID_ENVIRONMENT_TYPES = ['HOST', 'DOCKER', 'SSH'] as const;

/**
 * GET /api/environments - 環境一覧を取得
 *
 * クエリパラメータ:
 * - includeStatus=true: 各環境のステータス（available, authenticated）を含める
 *
 * @returns
 * - 200: 環境一覧
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest) {
  try {
    const includeStatus = request.nextUrl.searchParams.get('includeStatus') === 'true';

    const environments = await environmentService.findAll();

    if (includeStatus) {
      // 各環境のステータスを並列取得
      const envWithStatus = await Promise.all(
        environments.map(async (env) => ({
          ...env,
          status: await environmentService.checkStatus(env.id),
        }))
      );

      logger.debug('Environments retrieved with status', { count: envWithStatus.length });
      return NextResponse.json({ environments: envWithStatus });
    }

    logger.debug('Environments retrieved', { count: environments.length });
    return NextResponse.json({ environments });
  } catch (error) {
    logger.error('Failed to get environments', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/environments - 環境を作成
 *
 * リクエストボディ:
 * - name: 環境名（必須）
 * - type: 環境タイプ（HOST | DOCKER | SSH）（必須）
 * - description: 説明（任意）
 * - config: 設定オブジェクト（任意）
 *
 * DOCKER環境の場合は認証ディレクトリも自動作成されます。
 * config.imageSource === 'dockerfile' の場合、自動でDockerイメージをビルドします。
 *
 * @returns
 * - 201: 環境作成成功
 * - 400: バリデーションエラー / ビルドエラー
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name, type, description, config = {} } = body;

    // バリデーション
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'name is required and must be non-empty string' }, { status: 400 });
    }

    if (!type || !VALID_ENVIRONMENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_ENVIRONMENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    logger.info('Creating environment', { name, type });

    // Docker環境でDockerfileビルドが指定されている場合
    if (type === 'DOCKER' && config?.imageSource === 'dockerfile') {
      // dockerfilePathのバリデーション
      if (!config.dockerfilePath) {
        return NextResponse.json(
          { error: 'dockerfilePath is required when imageSource is dockerfile' },
          { status: 400 }
        );
      }

      // dockerfilePathを絶対パスに変換（getEnvironmentsDir()基準）
      const resolvedDockerfilePath = path.resolve(getEnvironmentsDir(), config.dockerfilePath);

      // パストラバーサル対策: 許可されたディレクトリかチェック
      if (!isPathAllowed(resolvedDockerfilePath)) {
        logger.warn('Attempted access to unauthorized path', { dockerfilePath: config.dockerfilePath });
        return NextResponse.json(
          { error: 'Dockerfile path is not allowed' },
          { status: 400 }
        );
      }

      // Dockerfile存在チェック
      try {
        await fs.access(resolvedDockerfilePath);
      } catch {
        // パス情報を漏洩させない
        return NextResponse.json(
          { error: 'Dockerfile not found' },
          { status: 400 }
        );
      }

      // 一時的なIDを生成（実際のID生成前）
      const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const buildImageName = `claude-work-env-${tempId}`;
      const dockerfileDir = path.dirname(resolvedDockerfilePath);
      const dockerfileName = path.basename(resolvedDockerfilePath);

      // ファイル名のバリデーション
      if (!isSafeFilename(dockerfileName)) {
        return NextResponse.json(
          { error: 'Invalid Dockerfile name' },
          { status: 400 }
        );
      }

      logger.info('Starting Docker image build for environment', {
        dockerfilePath: config.dockerfilePath,
        imageName: buildImageName,
        dockerfileDir,
      });

      try {
        // spawn を使用してコマンドインジェクションを防止
        const buildResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          const args = ['build', '-t', `${buildImageName}:latest`, '-f', dockerfileName, '.'];
          const child = spawn('docker', args, {
            cwd: dockerfileDir,
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          // タイムアウト設定 (10分)
          const timeout = setTimeout(() => {
            child.kill();
            reject(new Error('Build timeout'));
          }, 600000);

          child.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
              resolve({ stdout, stderr });
            } else {
              const error = new Error(`Build failed with code ${code}`) as Error & { stdout?: string; stderr?: string };
              error.stdout = stdout;
              error.stderr = stderr;
              reject(error);
            }
          });

          child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        logger.info('Docker image build completed', {
          imageName: `${buildImageName}:latest`,
          buildLog: (buildResult.stdout + buildResult.stderr).slice(0, 500), // ログは500文字まで
        });

        // 成功: configを更新
        config.imageName = buildImageName;
        config.imageTag = 'latest';
      } catch (error: unknown) {
        const buildError = error as Error & { stdout?: string; stderr?: string };

        logger.error('Docker image build failed for environment', {
          imageName: buildImageName,
          error: buildError.message,
        });

        return NextResponse.json(
          {
            error: 'Docker build failed',
            details: (buildError.stdout || '') + (buildError.stderr || ''),
          },
          { status: 400 }
        );
      }
    }

    // 環境を作成
    const environment = await environmentService.create({
      name: name.trim(),
      type,
      description: description?.trim(),
      config,
    });

    // DOCKER環境の場合は認証ディレクトリを作成
    if (type === 'DOCKER') {
      await environmentService.createAuthDirectory(environment.id);
      logger.info('Auth directory created for Docker environment', { id: environment.id });
    }

    logger.info('Environment created', { id: environment.id, name: environment.name });
    return NextResponse.json({ environment }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create environment', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
