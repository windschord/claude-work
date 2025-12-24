import { SessionOptions } from 'iron-session';

/**
 * iron-sessionのセッションデータ型定義
 */
export interface SessionData {
  /** 認証セッションID */
  sessionId?: string;
  /** 認証済みフラグ */
  isAuthenticated?: boolean;
}

/**
 * セッションパスワードの設定
 *
 * 本番環境ではSESSION_SECRET環境変数が必須です。
 * 開発環境では警告を表示しますが、デフォルト値を使用します。
 */
let sessionPassword: string | undefined = process.env.SESSION_SECRET;
if (!sessionPassword) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be set in production for session security.');
  } else {
    console.warn('[WARNING] SESSION_SECRET is not set. Using a default insecure password for development only.');
    sessionPassword = 'complex_password_at_least_32_characters_long';
  }
}

/**
 * iron-sessionの設定
 *
 * セッションクッキーの暗号化に使用される設定。
 * SESSION_SECRET環境変数は32文字以上が推奨される。
 */
export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24時間
    path: '/',
  },
};

/**
 * セッション型定義をモジュール拡張で宣言
 */
declare module 'iron-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IronSessionData extends SessionData {}
}
