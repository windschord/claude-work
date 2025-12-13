import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/logout - ユーザーログアウト
 *
 * 現在のセッションを削除し、セッションクッキーをクリアします。
 * 認証が必要です（sessionIdクッキー）。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 *
 * @returns
 * - 200: ログアウト成功、セッションクッキーを削除
 * - 401: 認証されていない（セッションが無効または期限切れ）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/auth/logout
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * { "message": "Logout successful" }
 * Set-Cookie: sessionId=; HttpOnly; Path=/; Max-Age=0
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete session from database
    await deleteSession(sessionId);

    // Clear session cookie
    const response = NextResponse.json({ message: 'Logout successful' });
    response.cookies.set('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    logger.info('User logged out successfully', { sessionId });
    return response;
  } catch (error) {
    logger.error('Logout error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
