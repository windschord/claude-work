import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/approve - 権限リクエストの承認
 *
 * セッションからの権限リクエストを承認します。
 * 初期実装では、承認のログを記録するのみです。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 承認成功
 * - 400: リクエストボディが不正
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/approve
 * Cookie: sessionId=<uuid>
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
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const targetSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
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
