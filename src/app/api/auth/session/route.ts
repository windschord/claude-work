import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/session - セッション状態確認
 *
 * 現在のセッションが有効かどうかを確認します。
 * クッキーからセッションIDを取得し、データベースで確認します。
 *
 * @param request - Next.jsリクエストオブジェクト
 *
 * @returns
 * - 200: セッション情報を返す（認証済み/未認証両方）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト（認証済み）
 * GET /api/auth/session
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "authenticated": true,
 *   "session_id": "uuid",
 *   "expires_at": "2024-01-01T00:00:00.000Z"
 * }
 *
 * // リクエスト（未認証）
 * GET /api/auth/session
 *
 * // レスポンス
 * {
 *   "authenticated": false
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    logger.info('Session check successful', { sessionId });
    return NextResponse.json({
      authenticated: true,
      session_id: session.id,
      expires_at: session.expires_at.toISOString(),
    });
  } catch (error) {
    logger.error('Session check error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
