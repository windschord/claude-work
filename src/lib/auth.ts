import { randomUUID, createHash } from 'crypto';
import { prisma } from './db';
import { NextRequest } from 'next/server';

/**
 * トークンをSHA-256でハッシュ化
 *
 * セキュリティ上の理由から、トークンはハッシュ化して保存します。
 *
 * @param token - ハッシュ化するトークン
 * @returns SHA-256ハッシュ値（16進数文字列）
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 新しい認証セッションを作成
 *
 * ランダムなUUIDをセッションIDとして生成し、有効期限を24時間後に設定します。
 * トークンはSHA-256でハッシュ化して保存します。
 *
 * @param token - 認証トークン（平文）
 * @returns 作成されたセッションのID
 * @throws データベース操作が失敗した場合にエラーをスロー
 */
export async function createSession(token: string): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tokenHash = hashToken(token);

  await prisma.authSession.create({
    data: {
      id: sessionId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  });

  return sessionId;
}

/**
 * トークンを検証
 *
 * 提供されたトークンが環境変数のトークンと一致するかを確認します。
 *
 * @param token - 検証するトークン
 * @returns トークンが有効な場合はtrue、無効な場合はfalse
 */
export function validateToken(token: string): boolean {
  const validToken = process.env.CLAUDE_WORK_TOKEN;
  if (!validToken) {
    throw new Error('CLAUDE_WORK_TOKEN環境変数が設定されていません');
  }

  return token === validToken;
}

/**
 * セッション情報を取得
 *
 * 指定されたセッションIDの認証セッション情報を取得します。
 * セッションが存在しない、または有効期限が切れている場合はnullを返します。
 *
 * @param sessionId - 取得するセッションのID
 * @returns セッション情報、または存在しない/有効期限切れの場合はnull
 */
export async function getSession(sessionId: string) {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  // expires_atを明示的にDate型に変換
  const expiresAt = new Date(session.expires_at);
  const now = new Date();

  if (expiresAt < now) {
    return null;
  }

  return session;
}

/**
 * セッションを削除
 *
 * 指定されたセッションIDの認証セッションをデータベースから削除します。
 *
 * @param sessionId - 削除するセッションのID
 * @throws データベース操作が失敗した場合にエラーをスロー
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.authSession.delete({
    where: { id: sessionId },
  });
}

/**
 * 認証チェック（プレースホルダー）
 *
 * 現在は実装されていません。将来的に認証チェックを実装するためのプレースホルダーです。
 *
 * @param _request - リクエストオブジェクト（未使用）
 * @returns 常にtrueを返す（将来的には認証の成否を返す予定）
 * @todo 適切な認証チェックを実装する
 */
export function requireAuth(_request?: NextRequest) {
  // This function is referenced in the test import but not tested
  // Implementation placeholder for future use
  // TODO: Implement proper authentication check
  return true;
}
