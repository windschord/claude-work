import { NextRequest, NextResponse } from 'next/server';
import { DeveloperSettingsService } from '@/services/developer-settings-service';
import { logger } from '@/lib/logger';

const service = new DeveloperSettingsService();

// メールアドレスの基本的なバリデーション
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// リクエストボディのバリデーション
function validateSettingsInput(body: Record<string, unknown>): {
  valid: boolean;
  error?: { code: string; message: string; details?: { field: string; value: unknown } };
  data?: { git_username?: string; git_email?: string };
} {
  const { git_username, git_email } = body;

  // 両方未指定
  if (git_username === undefined && git_email === undefined) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'git_username または git_email のいずれかを指定してください',
      },
    };
  }

  // git_username バリデーション
  if (git_username !== undefined) {
    if (typeof git_username !== 'string' || git_username.length === 0) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Git Username は1文字以上で入力してください',
          details: { field: 'git_username', value: git_username },
        },
      };
    }
    if (git_username.length > 100) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Git Username は100文字以内で入力してください',
          details: { field: 'git_username', value: git_username },
        },
      };
    }
  }

  // git_email バリデーション
  if (git_email !== undefined) {
    if (typeof git_email !== 'string' || !isValidEmail(git_email)) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Git Email の形式が正しくありません',
          details: { field: 'git_email', value: git_email },
        },
      };
    }
  }

  return {
    valid: true,
    data: {
      ...(git_username !== undefined && { git_username: git_username as string }),
      ...(git_email !== undefined && { git_email: git_email as string }),
    },
  };
}

/**
 * GET /api/developer-settings/global - グローバルGit設定を取得
 */
export async function GET(_request: NextRequest) {
  try {
    const settings = await service.getGlobalSettings();

    if (!settings) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'グローバル設定が見つかりません',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    logger.error('Failed to get global settings', { error });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/developer-settings/global - グローバルGit設定を更新
 */
export async function PUT(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '不正なJSONです',
          },
        },
        { status: 400 }
      );
    }

    const validation = validateSettingsInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const settings = await service.updateGlobalSettings(validation.data!);

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    logger.error('Failed to update global settings', { error });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
        },
      },
      { status: 500 }
    );
  }
}
