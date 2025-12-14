import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * GET /api/sessions/[id]/diff - セッションの差分取得
 *
 * 指定されたセッションのGit差分（mainブランチとの比較）を取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 差分情報（ファイルごとの詳細情報を含む）
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/diff
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   files: [
 *     {
 *       path: "file.ts",
 *       status: "modified",
 *       additions: 5,
 *       deletions: 3,
 *       oldContent: "const old = true;",
 *       newContent: "const new = true;"
 *     }
 *   ],
 *   totalAdditions: 5,
 *   totalDeletions: 3
 * }
 * ```
 */
export async function GET(
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

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const diff = gitService.getDiffDetails(sessionName);

    logger.info('Got diff for session', { id });
    return NextResponse.json(diff);
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get diff', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
