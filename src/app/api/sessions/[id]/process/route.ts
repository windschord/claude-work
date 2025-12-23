import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = ProcessManager.getInstance();

/**
 * GET /api/sessions/[id]/process - プロセス状態確認
 *
 * 指定されたIDのセッションのClaude Codeプロセスが実行中かどうかを確認します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: プロセス状態 { running: boolean }
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/process
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス（プロセス実行中）
 * {
 *   "running": true
 * }
 *
 * // レスポンス（プロセス停止中）
 * {
 *   "running": false
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

    const running = processManager.hasProcess(targetSession.id);

    logger.debug('Process status checked', { session_id: id, running });
    return NextResponse.json({ running });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to check process status', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
