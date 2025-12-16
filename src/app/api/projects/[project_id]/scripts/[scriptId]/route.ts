import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PUT /api/projects/[project_id]/scripts/[scriptId] - スクリプト更新
 *
 * 指定されたランスクリプトを更新します。
 * 認証が必要です。
 *
 * @param request - リクエストボディに更新フィールドを含むJSON、sessionIdクッキー
 * @param params - idとscriptIdを含むパスパラメータ
 *
 * @returns
 * - 200: スクリプト更新成功
 * - 401: 認証されていない
 * - 404: スクリプトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * PUT /api/projects/uuid-123/scripts/script-uuid
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * {
 *   "name": "Test Updated",
 *   "description": "Run all tests",
 *   "command": "npm run test:all"
 * }
 *
 * // レスポンス
 * {
 *   "id": "script-uuid",
 *   "project_id": "project-uuid",
 *   "name": "Test Updated",
 *   "description": "Run all tests",
 *   "command": "npm run test:all",
 *   "created_at": "2025-12-08T10:00:00Z",
 *   "updated_at": "2025-12-08T10:00:00Z"
 * }
 * ```
 */
export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ project_id: string; scriptId: string }>;
  }
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
    const { project_id: projectId, scriptId } = resolvedParams;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, projectId, scriptId });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 型検証
    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name must be a string' },
        { status: 400 }
      );
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string' },
        { status: 400 }
      );
    }

    if (body.command !== undefined && typeof body.command !== 'string') {
      return NextResponse.json(
        { error: 'Command must be a string' },
        { status: 400 }
      );
    }

    // 空文字列チェック
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    if (body.command !== undefined && !body.command.trim()) {
      return NextResponse.json(
        { error: 'Command cannot be empty' },
        { status: 400 }
      );
    }

    const existing = await prisma.runScript.findFirst({
      where: { id: scriptId, project_id: projectId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    const script = await prisma.runScript.update({
      where: { id: existing.id },
      data: {
        name: body.name ? body.name.trim() : existing.name,
        description: body.description !== undefined ? body.description.trim() || null : existing.description,
        command: body.command ? body.command.trim() : existing.command,
      },
    });

    logger.info('Script updated', { scriptId, name: script.name });
    return NextResponse.json(script);
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to update script', {
      error,
      scriptId: resolvedParams.scriptId,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[project_id]/scripts/[scriptId] - スクリプト削除
 *
 * 指定されたランスクリプトを削除します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params - idとscriptIdを含むパスパラメータ
 *
 * @returns
 * - 204: スクリプト削除成功（レスポンスボディなし）
 * - 401: 認証されていない
 * - 404: スクリプトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/projects/uuid-123/scripts/script-uuid
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ project_id: string; scriptId: string }>;
  }
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
    const { project_id: projectId, scriptId } = resolvedParams;

    const existing = await prisma.runScript.findFirst({
      where: { id: scriptId, project_id: projectId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    await prisma.runScript.delete({
      where: { id: existing.id },
    });

    logger.info('Script deleted', { scriptId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const resolvedParams = await params;
    logger.error('Failed to delete script', {
      error,
      scriptId: resolvedParams.scriptId,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
