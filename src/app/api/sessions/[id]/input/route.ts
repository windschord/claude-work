import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/input - セッションへのメッセージ送信
 *
 * ユーザーからのメッセージをセッションに送信します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: メッセージ送信成功、作成されたメッセージを返す
 * - 400: リクエストボディが不正
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/input
 * Cookie: sessionId=<uuid>
 * {
 *   "content": "Hello, Claude!"
 * }
 *
 * // レスポンス
 * {
 *   "id": "message-uuid",
 *   "session_id": "session-uuid",
 *   "role": "user",
 *   "content": "Hello, Claude!",
 *   "sub_agents": null,
 *   "created_at": "2025-12-14T00:00:00.000Z"
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
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Create user message
    const message = await prisma.message.create({
      data: {
        session_id: id,
        role: 'user',
        content,
      },
    });

    logger.info('Message sent to session', { session_id: id, message_id: message.id });
    return NextResponse.json(message);
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to send message', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
