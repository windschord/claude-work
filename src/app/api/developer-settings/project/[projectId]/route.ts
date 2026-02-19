import { NextRequest, NextResponse } from 'next/server';
import { DeveloperSettingsService, SettingsNotFoundError } from '@/services/developer-settings-service';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
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

// プロジェクト存在確認
function findProject(projectId: string) {
  return db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();
}

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/developer-settings/project/:projectId - プロジェクト別Git設定を取得
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { projectId } = await context.params;

    // プロジェクト存在確認
    const project = findProject(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'プロジェクトが見つかりません',
          },
        },
        { status: 404 }
      );
    }

    const [projectSettings, effectiveSettings] = await Promise.all([
      service.getProjectSettings(projectId),
      service.getEffectiveSettings(projectId),
    ]);

    // effective_settings のレスポンス構築
    const effective = {
      git_username: effectiveSettings.git_username,
      git_email: effectiveSettings.git_email,
      source: effectiveSettings.source.git_username || effectiveSettings.source.git_email || null,
    };

    if (projectSettings) {
      return NextResponse.json(
        {
          ...projectSettings,
          effective_settings: effective,
        },
        { status: 200 }
      );
    }

    // プロジェクト設定がない場合
    return NextResponse.json(
      {
        id: null,
        scope: 'PROJECT',
        project_id: projectId,
        git_username: null,
        git_email: null,
        created_at: null,
        updated_at: null,
        effective_settings: effective,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to get project settings', { error });
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
 * PUT /api/developer-settings/project/:projectId - プロジェクト別Git設定を更新
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { projectId } = await context.params;

    // プロジェクト存在確認
    const project = findProject(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'プロジェクトが見つかりません',
          },
        },
        { status: 404 }
      );
    }

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

    const settings = await service.updateProjectSettings(projectId, validation.data!);

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    logger.error('Failed to update project settings', { error });
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
 * DELETE /api/developer-settings/project/:projectId - プロジェクト別Git設定を削除
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { projectId } = await context.params;

    // プロジェクト存在確認
    const project = findProject(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'プロジェクトが見つかりません',
          },
        },
        { status: 404 }
      );
    }

    await service.deleteProjectSettings(projectId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SettingsNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'プロジェクト設定が見つかりません',
          },
        },
        { status: 404 }
      );
    }

    logger.error('Failed to delete project settings', { error });
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
