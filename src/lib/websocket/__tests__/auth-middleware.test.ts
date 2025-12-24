import { describe, it, expect, beforeEach } from 'vitest';
import { IncomingMessage } from 'http';
import { authenticateWebSocket } from '../auth-middleware';
import { createSession } from '../../auth';
import { prisma } from '../../db';

/**
 * WebSocket認証ミドルウェアのユニットテスト
 *
 * タスク19.2.1: WebSocket認証修正のテスト
 *
 * テスト対象:
 * 1. 有効な認証セッションIDがある場合、認証成功
 * 2. 無効な認証セッションIDがある場合、認証失敗
 * 3. クッキーがない場合、認証失敗
 * 4. pathSessionIdとcookieSessionIdが異なっていても認証成功
 */
describe('WebSocket Auth Middleware', () => {
  let validAuthSessionId: string;
  let validClaudeWorkSessionId: string;

  beforeEach(async () => {
    // テスト用データベースをクリーンアップ
    await prisma.session.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.project.deleteMany();

    // 有効な認証セッションを作成
    const testToken = 'test-token-for-websocket';
    validAuthSessionId = await createSession(testToken);

    // テスト用プロジェクトを作成
    const project = await prisma.project.create({
      data: {
        name: 'test-project',
        path: '/test/project',
        default_model: 'auto',
      },
    });

    // 有効なClaude Workセッションを作成（データベース）
    const claudeWorkSession = await prisma.session.create({
      data: {
        name: 'test-websocket-session',
        project_id: project.id,
        worktree_path: '/test/worktree',
        branch_name: 'test-branch',
        status: 'active',
        model: 'auto',
      },
    });
    validClaudeWorkSessionId = claudeWorkSession.id;
  });

  describe('認証成功ケース', () => {
    it('有効な認証セッションIDがある場合、認証成功する', async () => {
      // クッキーに有効な認証セッションIDを含むリクエストを作成
      const request = createMockRequest({
        sessionId: validAuthSessionId,
      });

      // pathSessionIdにはClaude WorkセッションIDを指定
      const result = await authenticateWebSocket(request, validClaudeWorkSessionId);

      // 認証成功の場合、pathSessionId（Claude WorkセッションID）が返される
      expect(result).toBe(validClaudeWorkSessionId);
    });

    it('pathSessionIdとcookieSessionIdが異なっていても認証成功する', async () => {
      // これは修正後の期待される動作
      // cookieSessionIdは認証用、pathSessionIdはセッション識別用として異なる値を持つ
      const request = createMockRequest({
        sessionId: validAuthSessionId,
      });

      // pathSessionIdにはClaude WorkセッションIDを指定（cookieSessionIdとは異なる）
      const result = await authenticateWebSocket(request, validClaudeWorkSessionId);

      // cookieSessionIdが有効であれば、pathSessionIdが異なっても認証成功
      expect(result).toBe(validClaudeWorkSessionId);
    });
  });

  describe('認証失敗ケース', () => {
    it('無効な認証セッションIDがある場合、認証失敗する', async () => {
      // クッキーに無効な認証セッションIDを含むリクエストを作成
      const request = createMockRequest({
        sessionId: 'invalid-session-id-12345',
      });

      const result = await authenticateWebSocket(request, validClaudeWorkSessionId);

      // 認証失敗の場合、nullが返される
      expect(result).toBeNull();
    });

    it('クッキーがない場合、認証失敗する', async () => {
      // クッキーなしのリクエストを作成
      const request = createMockRequest({});

      const result = await authenticateWebSocket(request, validClaudeWorkSessionId);

      // 認証失敗の場合、nullが返される
      expect(result).toBeNull();
    });
  });

  describe('⚠️ 認可ギャップ（既知のセキュリティ制限）', () => {
    it('異なるユーザーのセッションにアクセスできる（user_idフィールドがないため）', async () => {
      // ユーザーA用の認証セッションを作成
      const userAToken = 'user-a-token';
      const userAAuthSessionId = await createSession(userAToken);

      // ユーザーB用の認証セッションを作成
      const userBToken = 'user-b-token';
      const _userBAuthSessionId = await createSession(userBToken);

      // ユーザーAのクッキーでユーザーBのセッションにアクセスを試みる
      const request = createMockRequest({
        sessionId: userAAuthSessionId,
      });

      const result = await authenticateWebSocket(request, validClaudeWorkSessionId);

      // ⚠️ 現在は認証成功してしまう（認可チェックがないため）
      // これは既知のセキュリティ制限で、user_idフィールドが追加されるまで修正されません
      expect(result).toBe(validClaudeWorkSessionId);

      // TODO (Phase 20+): user_idフィールド追加後は、この動作を変更する
      // 期待される動作: 別ユーザーのセッションへのアクセスは拒否されるべき
      // expect(result).toBeNull();
    });
  });
});

/**
 * モックIncomingMessageを作成するヘルパー関数
 *
 * @param cookies - クッキーのキーと値のマップ
 * @returns モックされたIncomingMessageオブジェクト
 */
function createMockRequest(cookies: Record<string, string>): IncomingMessage {
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('; ');

  return {
    headers: {
      cookie: cookieString || undefined,
    },
  } as IncomingMessage;
}
