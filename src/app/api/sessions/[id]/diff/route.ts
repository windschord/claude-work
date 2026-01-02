import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * GET /api/sessions/[id]/diff - セッションの差分取得
 *
 * 指定されたセッションのGit差分（mainブランチとの比較）を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 差分情報（統一形式）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/diff
 *
 * // レスポンス
 * {
 *   "diff": {
 *     "files": [
 *       {
 *         "path": "file.ts",
 *         "status": "modified",
 *         "additions": 5,
 *         "deletions": 3,
 *         "oldContent": "const old = true;",
 *         "newContent": "const new = true;"
 *       }
 *     ],
 *     "totalAdditions": 5,
 *     "totalDeletions": 3
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    return NextResponse.json({ diff });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get diff', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
