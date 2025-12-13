import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = new ProcessManager();

/**
 * POST /api/sessions/[id]/stop - セッションの停止
 *
 * 指定されたセッションの実行中プロセスを停止し、ステータスを'completed'に更新します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 停止成功、更新されたセッション情報を返す
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/stop
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "id": "session-uuid",
 *   "project_id": "uuid-1234",
 *   "name": "新機能実装",
 *   "status": "completed",
 *   "model": "claude-3-5-sonnet-20241022",
 *   "worktree_path": "/path/to/worktrees/session-1234567890",
 *   "branch_name": "session/session-1234567890",
 *   "created_at": "2025-12-13T09:00:00.000Z"
 * }
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
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Stop the process
    try {
      await processManager.stop(targetSession.id);
      logger.debug('Process stopped', { session_id: targetSession.id });
    } catch (error) {
      logger.warn('Failed to stop process', {
        error,
        session_id: targetSession.id,
      });
    }

    // Update session status to completed
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { status: 'completed' },
    });

    logger.info('Session stopped', { id });
    return NextResponse.json(updatedSession);
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to stop session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
