import { IncomingMessage } from 'http';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../session';
import { getSession } from '../auth';
import { logger } from '../logger';

/**
 * WebSocket接続の認証ミドルウェア
 *
 * クッキーからセッション情報を取得し、認証済みかどうかを検証します。
 * 認証に失敗した場合はnullを返します。
 *
 * @param request - WebSocketアップグレードリクエスト
 * @returns 認証に成功した場合はセッションID、失敗した場合はnull
 */
export async function authenticateWebSocket(
  request: IncomingMessage
): Promise<string | null> {
  try {
    // クッキーヘッダーからセッションIDを抽出
    const cookies = parseCookies(request.headers.cookie || '');
    const sessionId = cookies['sessionId'];

    if (!sessionId) {
      logger.warn('WebSocket authentication failed: No session cookie');
      return null;
    }

    // セッションを検証
    const session = await getSession(sessionId);
    if (!session) {
      logger.warn('WebSocket authentication failed: Invalid session', { sessionId });
      return null;
    }

    logger.info('WebSocket authentication successful', { sessionId });
    return sessionId;
  } catch (error) {
    logger.error('WebSocket authentication error', { error });
    return null;
  }
}

/**
 * iron-sessionを使用したWebSocket認証（将来的な実装用）
 *
 * 現在は使用されていませんが、iron-sessionの暗号化されたクッキーを
 * 使用した認証に移行する際に利用できます。
 *
 * @param request - WebSocketアップグレードリクエスト
 * @returns 認証に成功した場合はセッションデータ、失敗した場合はnull
 */
export async function authenticateWebSocketWithIronSession(
  request: IncomingMessage
): Promise<SessionData | null> {
  try {
    // Node.jsのIncomingMessageをironSessionが期待する形式に変換
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = request as any;
    req.headers = request.headers;

    // レスポンスオブジェクトのモック（iron-sessionが必要とする）
    const res = {
      getHeader: () => undefined,
      setHeader: () => {},
      removeHeader: () => {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    if (!session.isAuthenticated || !session.sessionId) {
      logger.warn('WebSocket authentication failed: Not authenticated');
      return null;
    }

    logger.info('WebSocket authentication successful', {
      sessionId: session.sessionId,
    });
    return session;
  } catch (error) {
    logger.error('WebSocket authentication error', { error });
    return null;
  }
}

/**
 * クッキー文字列をパースしてオブジェクトに変換
 *
 * @param cookieString - クッキー文字列（例: "sessionId=abc; token=xyz"）
 * @returns クッキーのキーと値のマップ
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieString) {
    return cookies;
  }

  cookieString.split(';').forEach((cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });

  return cookies;
}
