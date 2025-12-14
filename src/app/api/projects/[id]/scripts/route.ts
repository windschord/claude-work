import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[id]/scripts - スクリプト一覧取得
 *
 * 指定されたプロジェクトのランスクリプト一覧を取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params - idを含むパスパラメータ
 *
 * @returns
 * - 200: スクリプト一覧取得成功
 * - 401: 認証されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects/uuid-123/scripts
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * [
 *   {
 *     "id": "script-uuid",
 *     "project_id": "project-uuid",
 *     "name": "Test",
 *     "description": "Run unit tests",
 *     "command": "npm test",
 *     "created_at": "2025-12-08T10:00:00Z",
 *     "updated_at": "2025-12-08T10:00:00Z"
 *   }
 * ]
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id: projectId } = resolvedParams;

    const scripts = await prisma.runScript.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' },
    });

    logger.info('Scripts fetched', { projectId, count: scripts.length });
    return NextResponse.json(scripts);
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to fetch scripts', {
      error,
      projectId: resolvedParams.id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/scripts - スクリプト追加
 *
 * 指定されたプロジェクトにランスクリプトを追加します。
 * 認証が必要です。
 *
 * @param request - リクエストボディにname, description, commandを含むJSON、sessionIdクッキー
 * @param params - idを含むパスパラメータ
 *
 * @returns
 * - 201: スクリプト追加成功
 * - 400: 必須フィールドが不足している
 * - 401: 認証されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects/uuid-123/scripts
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * {
 *   "name": "Test",
 *   "description": "Run unit tests",
 *   "command": "npm test"
 * }
 *
 * // レスポンス
 * {
 *   "id": "script-uuid",
 *   "project_id": "project-uuid",
 *   "name": "Test",
 *   "description": "Run unit tests",
 *   "command": "npm test",
 *   "created_at": "2025-12-08T10:00:00Z",
 *   "updated_at": "2025-12-08T10:00:00Z"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id: projectId } = resolvedParams;

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

    if (!name || !command) {
      return NextResponse.json(
        { error: 'Name and command are required' },
        { status: 400 }
      );
    }

    const script = await prisma.runScript.create({
      data: {
        project_id: projectId,
        name,
        description: description || null,
        command,
      },
    });

    logger.info('Script created', { scriptId: script.id, name: script.name });
    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to create script', {
      error,
      projectId: resolvedParams.id,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
