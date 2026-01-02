import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * PUT /api/projects/[project_id] - プロジェクト更新
 *
 * 指定されたプロジェクトの設定を更新します。
 *
 * @param request - リクエストボディに更新フィールドを含むJSON
 * @param params - project_idを含むパスパラメータ
 *
 * @returns
 * - 200: プロジェクト更新成功
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * PUT /api/projects/uuid-123
 * Content-Type: application/json
 * {
 *   "name": "Updated Project",
 *   "default_model": "opus",
 *   "run_scripts": false
 * }
 * ```
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id: project_id },
      data: {
        name: body.name ?? existing.name,
        default_model: body.default_model ?? existing.default_model,
      },
    });

    logger.info('Project updated', { id: project_id, name: project.name });
    return NextResponse.json({ project });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to update project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[project_id] - プロジェクト削除
 *
 * 指定されたプロジェクトを削除します。
 *
 * @param params - project_idを含むパスパラメータ
 *
 * @returns
 * - 204: プロジェクト削除成功（レスポンスボディなし）
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/projects/uuid-123
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    const existing = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id: project_id },
    });

    logger.info('Project deleted', { id: project_id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to delete project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
