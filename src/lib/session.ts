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
 * iron-sessionの設定
 *
 * セッションクッキーの暗号化に使用される設定。
 * SESSION_SECRET環境変数は32文字以上の推奨される。
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
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
