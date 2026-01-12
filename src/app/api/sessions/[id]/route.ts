import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/services/session-manager';
import { ContainerManager } from '@/services/container-manager';
import { logger } from '@/lib/logger';

const sessionManager = new SessionManager();
const containerManager = new ContainerManager();

/**
 * GET /api/sessions/[id] - セッション詳細取得
 *
 * 指定されたIDのセッション情報を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション情報
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await sessionManager.findById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    logger.debug('Session retrieved', { id });
    return NextResponse.json({ session });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/[id] - セッション削除
 *
 * 指定されたIDのセッションを削除します。
 * コンテナ、Volume、データベースレコードが削除されます。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 204: 削除成功（レスポンスボディなし）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await sessionManager.findById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await containerManager.deleteSession(id);

    logger.info('Session deleted via API', { id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to delete session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/[id] - セッション情報更新
 *
 * 指定されたIDのセッション情報を更新します。
 * 現在はセッション名の更新のみサポートしています。
 *
 * @param request - ボディにnameを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 更新成功（セッション情報を含む）
 * - 400: 名前が空またはバリデーションエラー
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // リクエストボディの解析
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name } = body;

    // 名前のバリデーション
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // セッションが存在するか確認
    const existingSession = await sessionManager.findById(id);

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Note: SessionManager needs an updateName method
    // For now, we'll need to add this functionality
    // Using prisma directly as a workaround until SessionManager is extended
    const { prisma } = await import('@/lib/db');
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { name: trimmedName },
    });

    logger.info('Session name updated', { id, name: trimmedName });
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to update session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
