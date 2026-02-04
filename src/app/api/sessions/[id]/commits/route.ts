import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * GET /api/sessions/[id]/commits - セッションのコミット履歴取得
 *
 * 指定されたセッションのGitコミット履歴を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: コミット履歴（統一形式）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/commits
 *
 * // レスポンス
 * {
 *   "commits": [
 *     {
 *       "hash": "abc123def456",
 *       "short_hash": "abc123d",
 *       "message": "Add authentication",
 *       "author": "Claude",
 *       "date": "2025-12-08T10:05:00Z",
 *       "files_changed": 3
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const commits = gitService.getCommits(sessionName);

    logger.info('Got commits for session', { id, count: commits.length });
    return NextResponse.json({ commits });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get commits', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
