import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * GET /api/sessions/[id]/messages - セッションのメッセージ一覧取得
 *
 * 指定されたセッションのメッセージ一覧を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: メッセージ一覧
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/messages
 *
 * // レスポンス
 * {
 *   "messages": [
 *     {
 *       "id": "msg-1",
 *       "session_id": "session-uuid",
 *       "role": "user",
 *       "content": "Hello",
 *       "sub_agents": null,
 *       "created_at": "2025-12-14T00:00:00.000Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
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

    const messages = await db.select()
      .from(schema.messages)
      .where(eq(schema.messages.session_id, id))
      .orderBy(asc(schema.messages.created_at))
      .all();

    logger.debug('Messages retrieved', { session_id: id, count: messages.length });
    return NextResponse.json({ messages });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get messages', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
