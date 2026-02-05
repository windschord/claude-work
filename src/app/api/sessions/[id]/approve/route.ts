import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/approve - 権限リクエストの承認
 *
 * セッションからの権限リクエストを承認します。
 * 初期実装では、承認のログを記録するのみです。
 *
 * @param request - リクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 承認成功
 * - 400: リクエストボディが不正
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/approve
 * {
 *   "action": "approve",
 *   "permission_id": "permission-uuid"
 * }
 *
 * // レスポンス
 * {
 *   "success": true,
 *   "action": "approve"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, session_id: id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { action, permission_id } = body;

    if (!action || !permission_id) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Log the approval/rejection
    logger.info('Permission request handled', {
      session_id: id,
      permission_id,
      action,
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to handle permission request', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
