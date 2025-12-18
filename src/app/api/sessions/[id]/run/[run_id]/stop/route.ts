import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RunScriptManager } from '@/services/run-script-manager';
import { logger } from '@/lib/logger';

const runScriptManager = RunScriptManager.getInstance();

/**
 * POST /api/sessions/[id]/run/[run_id]/stop - ランスクリプトの停止
 *
 * 実行中のランスクリプトを停止します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 * @param params.run_id - 実行ID
 *
 * @returns
 * - 200: ランスクリプト停止成功
 * - 401: 認証されていない
 * - 403: セッションへのアクセス権限がない
 * - 404: セッションまたはrun_idが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/run/run-uuid/stop
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "success": true
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; run_id: string }> }
) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authSession = await getSession(sessionId);
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, run_id } = await params;

    const targetSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (authSession.user_id !== targetSession.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if the run_id exists
    const runStatus = runScriptManager.getStatus(run_id);
    if (!runStatus) {
      return NextResponse.json({ error: 'Run script not found' }, { status: 404 });
    }

    // Stop the process
    try {
      await runScriptManager.stop(run_id);
      logger.info('Run script stopped', {
        session_id: targetSession.id,
        run_id,
      });
    } catch (error) {
      logger.warn('Failed to stop run script', { error, run_id });
      return NextResponse.json(
        { error: 'Failed to stop run script' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    let errorId = 'unknown';
    let errorRunId = 'unknown';
    try {
      const resolvedParams = await params;
      errorId = resolvedParams.id;
      errorRunId = resolvedParams.run_id;
    } catch {
      // params resolution failed, use defaults
    }
    logger.error('Failed to stop run script', {
      error,
      session_id: errorId,
      run_id: errorRunId,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
