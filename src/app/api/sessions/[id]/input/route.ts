import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/input - セッションへのメッセージ送信
 *
 * ユーザーからのメッセージをセッションに送信します。
 *
 * @param request - リクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 201: メッセージ作成成功（統一形式）
 * - 400: リクエストボディが不正
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/input
 * {
 *   "content": "Hello, Claude!"
 * }
 *
 * // レスポンス
 * {
 *   "message": {
 *     "id": "message-uuid",
 *     "session_id": "session-uuid",
 *     "role": "user",
 *     "content": "Hello, Claude!",
 *     "sub_agents": null,
 *     "created_at": "2025-12-14T00:00:00.000Z"
 *   }
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

    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Create user message
    const [message] = await db.insert(schema.messages)
      .values({
        session_id: id,
        role: 'user',
        content,
      })
      .returning();

    logger.info('Message sent to session', { session_id: id, message_id: message.id });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to send message', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
