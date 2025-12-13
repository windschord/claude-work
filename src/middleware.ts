import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js ミドルウェア - CORS設定とプリフライトリクエスト処理
 *
 * すべてのAPIリクエストに対してCORSヘッダーを設定します。
 * 許可されたオリジンは環境変数ALLOWED_ORIGINSで指定できます。
 * 開発環境ではすべてのオリジンを許可します。
 *
 * @param request - Next.jsリクエストオブジェクト
 * @returns レスポンスオブジェクト（CORSヘッダー付き）
 *
 * @example
 * 環境変数設定:
 * ```
 * ALLOWED_ORIGINS=https://example.com,https://app.example.com
 * ```
 */
export function middleware(request: NextRequest) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : (process.env.NODE_ENV === 'production' ? [] : ['*']);

  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // CORS設定
  if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  // OPTIONS リクエストへの対応
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

/**
 * ミドルウェア設定
 *
 * このミドルウェアを適用するパスパターンを指定します。
 * '/api/:path*'にマッチするすべてのリクエストに適用されます。
 */
export const config = {
  matcher: '/api/:path*',
};
