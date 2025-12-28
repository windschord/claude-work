import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getProcessLifecycleManager } from '@/services/process-lifecycle-manager';
import { logger } from '@/lib/logger';

/**
 * POST /api/sessions/[id]/resume - 一時停止中のセッションを再開
 *
 * paused状態のセッションのClaude Codeプロセスを再起動します。
 * resume_session_idが保存されている場合は--resumeオプションを使用して
 * 会話履歴を復元します。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション再開成功
 * - 400: セッションがpaused状態でない
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authSession = await getSession(sessionId);
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // セッション取得
    const targetSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // paused状態のみ再開可能
    if (targetSession.status !== 'paused') {
      return NextResponse.json(
        { error: 'Session is not paused' },
        { status: 400 }
      );
    }

    // ProcessLifecycleManagerでセッションを再開
    const lifecycleManager = getProcessLifecycleManager();

    try {
      await lifecycleManager.resumeSession(
        targetSession.id,
        targetSession.worktree_path,
        targetSession.model,
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
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: 'running',
        last_activity_at: new Date(),
      },
    });

    logger.info('Session resumed', {
      id,
      hadResumeSessionId: !!targetSession.resume_session_id,
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to resume session', { error, session_id: errorId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
