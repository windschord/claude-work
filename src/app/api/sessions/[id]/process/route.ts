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

/**
 * POST /api/sessions/[id]/process - プロセス再起動
 *
 * 停止中のセッションのClaude Codeプロセスを再起動します。
 * 既にプロセスが実行中の場合は何もせず成功を返します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 成功 { success: true, running: true } または { success: true, running: true, message: 'Process already running' }
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/process
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス（起動成功）
 * {
 *   "success": true,
 *   "running": true
 * }
 *
 * // レスポンス（既に実行中）
 * {
 *   "success": true,
 *   "running": true,
 *   "message": "Process already running"
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
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // プロセスが既に実行中かチェック
    const isRunning = processManager.hasProcess(targetSession.id);
    if (isRunning) {
      logger.debug('Process already running', { session_id: id });
      return NextResponse.json({
        success: true,
        running: true,
        message: 'Process already running',
      });
    }

    // プロセスを起動
    await processManager.startClaudeCode({
      sessionId: targetSession.id,
      worktreePath: targetSession.worktree_path,
      prompt: '',
      model: targetSession.model || undefined,
    });

    logger.info('Process started successfully', { session_id: id });
    return NextResponse.json({ success: true, running: true });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to start process', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
