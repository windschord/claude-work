import { IncomingMessage } from 'http';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../session';
import { getSession } from '../auth';
import { logger } from '../logger';
import { prisma } from '../db';

/**
 * WebSocket接続の認証ミドルウェア
 *
 * クッキーからセッション情報を取得し、認証済みかどうかを検証します。
 * 認証が成功した場合、URLパスのセッションIDを返します（セッション識別用）。
 * 認証に失敗した場合はnullを返します。
 *
 * @param request - WebSocketアップグレードリクエスト
 * @param pathSessionId - URLパスから抽出されたClaude WorkセッションID（セッション識別用）
 * @returns 認証に成功した場合はpathSessionId、失敗した場合はnull
 */
export async function authenticateWebSocket(
  request: IncomingMessage,
  pathSessionId: string
): Promise<string | null> {
  try {
    // クッキーヘッダーから認証セッションIDを抽出
    const cookies = parseCookies(request.headers.cookie || '');
    const cookieSessionId = cookies['sessionId'];

    if (!cookieSessionId) {
      logger.warn('WebSocket authentication failed: No session cookie');
      return null;
    }

    // 認証セッションの有効性を検証
    const authSession = await getSession(cookieSessionId);
    if (!authSession) {
      logger.warn('WebSocket authentication failed: Invalid session', { sessionId: cookieSessionId });
      return null;
    }

    // Claude Workセッションの存在確認（認可チェック）
    try {
      const sessionDetails = await prisma.session.findUnique({
        where: { id: pathSessionId },
        select: { project: { select: { id: true } } },
      });

      if (!sessionDetails) {
        logger.warn('WebSocket authorization failed: Session not found', { sessionId: pathSessionId });
        return null;
      }

      // ⚠️ SECURITY LIMITATION: Authorization gap
      // 現在のスキーマではsessionsテーブルにuser_idフィールドがないため、
      // 認証済みユーザーが他のユーザーのセッションにアクセスできる状態です。
      // これは既知のセキュリティ制限であり、将来のバージョンで修正が必要です。
      //
      // TODO (Phase 20+): user_idフィールドを追加して所有者チェックを実装
      // if (sessionDetails.user_id !== authSession.user_id) {
      //   logger.warn('WebSocket authorization failed: User not authorized', { sessionId: pathSessionId });
      //   return null;
      // }

      logger.info('WebSocket authentication successful', {
        authSessionId: cookieSessionId,
        claudeWorkSessionId: pathSessionId
      });
      return pathSessionId;
    } catch (error) {
      logger.error('WebSocket authorization error', { error });
      return null;
    }
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
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });

  return cookies;
}
