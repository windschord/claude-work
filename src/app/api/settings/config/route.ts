import { NextRequest, NextResponse } from 'next/server';
import { getConfigService } from '@/services/config-service';
import { validateTimeoutMinutes } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * GET /api/settings/config - 設定を取得
 *
 * @returns
 * - 200: 設定取得成功
 * - 500: サーバーエラー
 */
export async function GET() {
  try {
    const configService = getConfigService();
    const config = configService.getConfig();

    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    logger.error('Failed to get config', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/settings/config - 設定を更新
 *
 * @param request - リクエストボディ
 *   - git_clone_timeout_minutes: タイムアウト値（分）（任意、1-30分）
 *   - debug_mode_keep_volumes: Dockerボリューム保持フラグ（任意）
 *
 * @returns
 * - 200: 設定更新成功
 * - 400: バリデーションエラー
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // bodyがnullまたはobjectでない場合はエラー
    if (body === null || typeof body !== 'object') {
      logger.warn('Request body must be an object', { body });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { git_clone_timeout_minutes, debug_mode_keep_volumes } = body;

    // バリデーション
    if (git_clone_timeout_minutes !== undefined) {
      try {
        validateTimeoutMinutes(git_clone_timeout_minutes);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid timeout value';
        logger.warn('Invalid timeout value', { git_clone_timeout_minutes, error });
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }
    }

    if (debug_mode_keep_volumes !== undefined && typeof debug_mode_keep_volumes !== 'boolean') {
      return NextResponse.json(
        { error: 'debug_mode_keep_volumes must be a boolean' },
        { status: 400 }
      );
    }

    // 設定を保存
    const configService = getConfigService();
    await configService.save({
      ...(git_clone_timeout_minutes !== undefined && { git_clone_timeout_minutes }),
      ...(debug_mode_keep_volumes !== undefined && { debug_mode_keep_volumes }),
    });

    const updatedConfig = configService.getConfig();

    logger.info('Config updated', { config: updatedConfig });

    return NextResponse.json({ config: updatedConfig }, { status: 200 });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
