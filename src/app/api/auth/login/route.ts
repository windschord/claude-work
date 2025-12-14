import { NextRequest, NextResponse } from 'next/server';
import { createSession, validateToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/login - ユーザーログイン
 *
 * トークンベースの認証を行い、セッションを作成します。
 * 成功時にはHttpOnlyクッキーでセッションIDを設定します。
 * トークンはSHA-256でハッシュ化して保存されます。
 *
 * @param request - リクエストボディに`token`フィールドを含むJSONを期待
 *
 * @returns
 * - 200: ログイン成功、セッションIDをクッキーに設定
 * - 400: トークンが指定されていない、またはJSON解析エラー
 * - 401: トークンが無効
 * - 500: サーバーエラー（CLAUDE_WORK_TOKEN未設定を含む）
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/auth/login
 * Content-Type: application/json
 * { "token": "your-secret-token" }
 *
 * // レスポンス
 * { "message": "Login successful", "session_id": "uuid", "expires_at": "2024-01-01T00:00:00.000Z" }
 * Set-Cookie: sessionId=<uuid>; HttpOnly; Path=/; Max-Age=86400
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Validate token
    try {
      if (!validateToken(token)) {
        logger.warn('Login attempt with invalid token');
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } catch (error) {
      logger.error('AUTH_TOKEN environment variable is not configured', { error });
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      );
    }

    // Create session with hashed token
    const sessionId = await createSession(token);

    // Get session expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Set session cookie
    const response = NextResponse.json({
      message: 'Login successful',
      session_id: sessionId,
      expires_at: expiresAt.toISOString(),
    });
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    logger.info('User logged in successfully');
    return response;
  } catch (error) {
    logger.error('Login error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
