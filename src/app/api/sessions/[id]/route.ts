import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = ProcessManager.getInstance();

/**
 * GET /api/sessions/[id] - セッション詳細取得
 *
 * 指定されたIDのセッション情報を取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション情報
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "id": "session-uuid",
 *   "project_id": "uuid-1234",
 *   "name": "新機能実装",
 *   "status": "running",
 *   "model": "claude-3-5-sonnet-20241022",
 *   "worktree_path": "/path/to/worktrees/session-1234567890",
 *   "branch_name": "session/session-1234567890",
 *   "created_at": "2025-12-13T09:00:00.000Z"
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
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    logger.debug('Session retrieved', { id });
    return NextResponse.json(targetSession);
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/[id] - セッション削除
 *
 * 指定されたIDのセッションを削除します。
 * 実行中のプロセスは停止され、Git worktreeが削除され、データベースからセッションが削除されます。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 204: 削除成功（レスポンスボディなし）
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/sessions/session-uuid
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
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

    // Stop process if running
    if (targetSession.status === 'running' || targetSession.status === 'waiting_input') {
      try {
        await processManager.stop(targetSession.id);
        logger.debug('Process stopped before deletion', { session_id: targetSession.id });
      } catch (error) {
        logger.warn('Failed to stop process before deletion', {
          error,
          session_id: targetSession.id,
        });
      }
    }

    // Remove worktree
    try {
      const gitService = new GitService(targetSession.project.path, logger);
      const sessionName = targetSession.worktree_path.split('/').pop() || '';
      gitService.deleteWorktree(sessionName);
      logger.debug('Worktree removed', { worktree_path: targetSession.worktree_path });
    } catch (error) {
      logger.warn('Failed to remove worktree', {
        error,
        worktree_path: targetSession.worktree_path,
      });
    }

    // Delete session from database
    await prisma.session.delete({
      where: { id },
    });

    logger.info('Session deleted', { id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to delete session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
