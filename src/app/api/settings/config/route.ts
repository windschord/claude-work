import { NextRequest, NextResponse } from 'next/server';
import { ensureConfigLoaded } from '@/services/config-service';
import { validateTimeoutMinutes } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { ClaudeOptionsService } from '@/services/claude-options-service';

/**
 * GET /api/settings/config - 設定を取得
 *
 * @returns
 * - 200: 設定取得成功
 * - 500: サーバーエラー
 */
export async function GET() {
  try {
    const configService = await ensureConfigLoaded();
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

    const { git_clone_timeout_minutes, debug_mode_keep_volumes, registry_firewall_enabled, claude_defaults, custom_env_vars } = body;

    // claude_defaults バリデーション
    if (claude_defaults !== undefined) {
      if (claude_defaults === null || typeof claude_defaults !== 'object' || Array.isArray(claude_defaults)) {
        return NextResponse.json(
          { error: 'claude_defaults must be an object' },
          { status: 400 }
        );
      }

      const allowedKeys = new Set(['dangerouslySkipPermissions', 'worktree']);
      const unknownKeys = Object.keys(claude_defaults).filter((key: string) => !allowedKeys.has(key));
      if (unknownKeys.length > 0) {
        return NextResponse.json(
          { error: `Unknown keys in claude_defaults: ${unknownKeys.join(', ')}` },
          { status: 400 }
        );
      }

      if (claude_defaults.dangerouslySkipPermissions !== undefined && typeof claude_defaults.dangerouslySkipPermissions !== 'boolean') {
        return NextResponse.json(
          { error: 'claude_defaults.dangerouslySkipPermissions must be a boolean' },
          { status: 400 }
        );
      }

      if (claude_defaults.worktree !== undefined && typeof claude_defaults.worktree !== 'boolean') {
        return NextResponse.json(
          { error: 'claude_defaults.worktree must be a boolean' },
          { status: 400 }
        );
      }
    }

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

    if (registry_firewall_enabled !== undefined && typeof registry_firewall_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'registry_firewall_enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (custom_env_vars !== undefined) {
      const validated = ClaudeOptionsService.validateCustomEnvVars(custom_env_vars);
      if (validated === null) {
        return NextResponse.json(
          { error: 'custom_env_vars must be an object with uppercase keys and string values' },
          { status: 400 }
        );
      }
    }

    // 設定を保存
    const configService = await ensureConfigLoaded();
    await configService.save({
      ...(git_clone_timeout_minutes !== undefined && { git_clone_timeout_minutes }),
      ...(debug_mode_keep_volumes !== undefined && { debug_mode_keep_volumes }),
      ...(registry_firewall_enabled !== undefined && { registry_firewall_enabled }),
      ...(claude_defaults !== undefined && { claude_defaults }),
      ...(custom_env_vars !== undefined && { custom_env_vars }),
    });

    const updatedConfig = configService.getConfig();

    logger.info('Config updated', { config: updatedConfig });

    return NextResponse.json({ config: updatedConfig }, { status: 200 });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
