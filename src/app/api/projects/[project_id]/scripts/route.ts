import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[project_id]/scripts - スクリプト一覧取得
 *
 * 指定されたプロジェクトのランスクリプト一覧を取得します。
 *
 * @param params - idを含むパスパラメータ
 *
 * @returns
 * - 200: スクリプト一覧（統一形式）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects/uuid-123/scripts
 *
 * // レスポンス
 * {
 *   "scripts": [
 *     {
 *       "id": "script-uuid",
 *       "project_id": "project-uuid",
 *       "name": "Test",
 *       "description": "Run unit tests",
 *       "command": "npm test",
 *       "created_at": "2025-12-08T10:00:00Z",
 *       "updated_at": "2025-12-08T10:00:00Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { project_id: projectId } = resolvedParams;

    const scripts = await prisma.runScript.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' },
    });

    logger.info('Scripts fetched', { projectId, count: scripts.length });
    return NextResponse.json({ scripts });
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to fetch scripts', {
      error,
      projectId: resolvedParams.project_id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[project_id]/scripts - スクリプト追加
 *
 * 指定されたプロジェクトにランスクリプトを追加します。
 *
 * @param request - リクエストボディにname, description, commandを含むJSON
 * @param params - idを含むパスパラメータ
 *
 * @returns
 * - 201: スクリプト追加成功（統一形式）
 * - 400: 必須フィールドが不足している
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects/uuid-123/scripts
 * Content-Type: application/json
 * {
 *   "name": "Test",
 *   "description": "Run unit tests",
 *   "command": "npm test"
 * }
 *
 * // レスポンス
 * {
 *   "script": {
 *     "id": "script-uuid",
 *     "project_id": "project-uuid",
 *     "name": "Test",
 *     "description": "Run unit tests",
 *     "command": "npm test",
 *     "created_at": "2025-12-08T10:00:00Z",
 *     "updated_at": "2025-12-08T10:00:00Z"
 *   }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { project_id: projectId } = resolvedParams;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, projectId });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { name, description, command } = body;

    // 型検証
    if (typeof name !== 'string' || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Name and command must be strings' },
        { status: 400 }
      );
    }

    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string' },
        { status: 400 }
      );
    }

    if (!name.trim() || !command.trim()) {
      return NextResponse.json(
        { error: 'Name and command cannot be empty' },
        { status: 400 }
      );
    }

    // シェルインジェクション対策: 危険なメタ文字を含むコマンドを拒否
    const dangerousPatterns = /[;&|`$(){}<>\n]/;
    if (dangerousPatterns.test(command)) {
      return NextResponse.json(
        {
          error:
            'Command contains dangerous shell metacharacters. ' +
            'Please use simple commands without ; & | ` $ () {} < > or newlines.',
        },
        { status: 400 }
      );
    }

    // プロジェクト存在確認
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const script = await prisma.runScript.create({
      data: {
        project_id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        command: command.trim(),
      },
    });

    logger.info('Script created', { scriptId: script.id, name: script.name });
    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to create script', {
      error,
      projectId: resolvedParams.project_id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
