import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * POST /api/sessions/[id]/reset - セッションのコミットリセット
 *
 * 指定されたセッションのブランチを特定のコミットにリセットします。
 * git reset --hard を使用するため、未コミットの変更は破棄されます。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーとリクエストボディ（commit_hash）を含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: リセット成功
 * - 400: commit_hashが未指定またはリセット失敗
 * - 401: 認証されていない
 * - 403: セッションへのアクセス権限がない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/reset
 * Cookie: sessionId=<uuid>
 * Body: { "commit_hash": "abc123" }
 *
 * // レスポンス（成功時）
 * { "success": true }
 *
 * // レスポンス（失敗時）
 * { "success": false, "error": "エラーメッセージ" }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const targetSession = await prisma.session.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (session.user_id !== targetSession.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { commit_hash } = body;

    if (!commit_hash || typeof commit_hash !== 'string') {
      return NextResponse.json({ error: 'commit_hash is required' }, { status: 400 });
    }

    const trimmedCommitHash = commit_hash.trim();
    const isValidCommitHash = /^[0-9a-f]{4,40}$/i.test(trimmedCommitHash);
    if (!isValidCommitHash) {
      return NextResponse.json({ error: 'Invalid commit_hash format' }, { status: 400 });
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const result = gitService.reset(sessionName, trimmedCommitHash);

    if (!result.success) {
      logger.warn('Reset failed', { id, commit_hash, error: result.error });
      return NextResponse.json(result, { status: 400 });
    }

    logger.info('Reset session successfully', { id, commit_hash });
    return NextResponse.json(result);
  } catch (error) {
    let errorId = 'unknown';
    try {
      const resolvedParams = await params;
      errorId = resolvedParams.id;
    } catch {
      // params resolution failed, use default
    }
    logger.error('Failed to reset session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
