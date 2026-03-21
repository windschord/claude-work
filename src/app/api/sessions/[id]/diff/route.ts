import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { GitService } from '@/services/git-service';
import { DockerGitService } from '@/services/docker-git-service';
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

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let diff;
    if (targetSession.project.clone_location === 'docker') {
      const dockerGitService = new DockerGitService();
      // Claude Code --worktreeモード（branch_name === ''）ではworktree_pathを直接使用
      if (!targetSession.branch_name) {
        diff = await dockerGitService.getDiffDetailsByPath(targetSession.project.id, targetSession.worktree_path, targetSession.project.docker_volume_id);
      } else {
        const sessionName = basename(targetSession.worktree_path);
        diff = await dockerGitService.getDiffDetails(targetSession.project.id, sessionName, targetSession.project.docker_volume_id);
      }
    } else {
      const gitService = new GitService(targetSession.project.path, logger);
      // Claude Code --worktreeモード（branch_name === ''）ではworktree_pathを直接使用
      if (!targetSession.branch_name) {
        diff = gitService.getDiffDetailsByPath(targetSession.worktree_path);
      } else {
        const sessionName = basename(targetSession.worktree_path);
        diff = gitService.getDiffDetails(sessionName);
      }
    }

    logger.info('Got diff for session', { id });
    return NextResponse.json({ diff });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get diff', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
