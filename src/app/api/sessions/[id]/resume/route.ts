import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getProcessLifecycleManager } from '@/services/process-lifecycle-manager';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/resume - 停止中のセッションを再開
 *
 * stopped状態のセッションのClaude Codeプロセスを再起動します。
 * resume_session_idが保存されている場合は--resumeオプションを使用して
 * 会話履歴を復元します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション再開成功
 * - 400: セッションがstopped状態でない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // セッション取得
    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // stopped状態のみ再開可能
    if (targetSession.status !== 'stopped') {
      return NextResponse.json(
        { error: 'Session is not stopped' },
        { status: 400 }
      );
    }

    // ProcessLifecycleManagerでセッションを再開
    const lifecycleManager = getProcessLifecycleManager();

    try {
      await lifecycleManager.resumeSession(
        targetSession.id,
        targetSession.worktree_path,
        targetSession.resume_session_id || undefined
      );
    } catch (error) {
      logger.error('Failed to resume session process', {
        error,
        session_id: targetSession.id,
      });
      return NextResponse.json(
        { error: 'Failed to resume session' },
        { status: 500 }
      );
    }

    // ステータスをrunningに更新
    const [updatedSession] = await db.update(schema.sessions)
      .set({
        status: 'running',
        last_activity_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(schema.sessions.id, id))
      .returning();

    const resumedWithHistory = !!targetSession.resume_session_id;

    logger.info('Session resumed', {
      id,
      resumedWithHistory,
    });

    return NextResponse.json({
      session: updatedSession,
      resumed_with_history: resumedWithHistory,
    });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to resume session', { error, session_id: errorId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
