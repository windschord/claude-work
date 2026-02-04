import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = ProcessManager.getInstance();

/**
 * POST /api/sessions/[id]/stop - セッションの停止
 *
 * 指定されたセッションの実行中プロセスを停止し、ステータスを'completed'に更新します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション停止成功（統一形式）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/stop
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "project_id": "uuid-1234",
 *     "name": "新機能実装",
 *     "status": "completed",
 *     "model": "claude-3-5-sonnet-20241022",
 *     "worktree_path": "/path/to/worktrees/session-1234567890",
 *     "branch_name": "session/session-1234567890",
 *     "created_at": "2025-12-13T09:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
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
    const [updatedSession] = await db.update(schema.sessions)
      .set({ status: 'completed', updated_at: new Date() })
      .where(eq(schema.sessions.id, id))
      .returning();

    logger.info('Session stopped', { id });
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to stop session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
