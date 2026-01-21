import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { logger } from '@/lib/logger';

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
 *
 * @returns
 * - 201: 環境作成成功
 * - 400: バリデーションエラー
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
