import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/login - ユーザーログイン
 *
 * トークンベースの認証を行い、セッションを作成します。
 * 成功時にはHttpOnlyクッキーでセッションIDを設定します。
 *
 * @param request - リクエストボディに`token`フィールドを含むJSONを期待
 *
 * @returns
 * - 200: ログイン成功、セッションIDをクッキーに設定
 * - 400: トークンが指定されていない
 * - 401: トークンが無効
 * - 500: サーバーエラー（AUTH_TOKEN未設定を含む）
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/auth/login
 * Content-Type: application/json
 * { "token": "your-secret-token" }
 *
 * // レスポンス
 * { "message": "Login successful" }
 * Set-Cookie: sessionId=<uuid>; HttpOnly; Path=/; Max-Age=86400
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const AUTH_TOKEN = process.env.AUTH_TOKEN;
    if (!AUTH_TOKEN) {
      logger.error('AUTH_TOKEN environment variable is not configured');
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      );
    }

    // Simple token comparison (in production, use bcrypt)
    if (token !== AUTH_TOKEN) {
      logger.warn('Login attempt with invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Create session
    const sessionId = await createSession();

    // Set session cookie
    const response = NextResponse.json({ message: 'Login successful' });
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    logger.info('User logged in successfully', { sessionId });
    return response;
  } catch (error) {
    logger.error('Login error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
