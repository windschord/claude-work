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
  const port = process.env.PORT || '3000';
  const defaultProductionOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ];

  let allowedOrigins: string[];
  if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*') {
    // 明示的にオリジンが指定されている場合
    allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  } else if (process.env.NODE_ENV === 'production') {
    // 本番環境ではlocalhost/127.0.0.1をデフォルトで許可
    allowedOrigins = defaultProductionOrigins;
  } else {
    // 開発環境ではすべてのオリジンを許可
    allowedOrigins = ['*'];
  }

  const origin = request.headers.get('origin');
  const response = NextResponse.next();
  let originAllowed = false;

  // CORS設定 - 認証情報を使用する場合は特定のオリジンをエコーバック
  if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    originAllowed = true;
  } else if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    originAllowed = true;
  }

  if (originAllowed) {
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

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
