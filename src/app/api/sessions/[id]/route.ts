import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = ProcessManager.getInstance();

/**
 * GET /api/sessions/[id] - セッション詳細取得
 *
 * 指定されたIDのセッション情報を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション情報（統一形式）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "project_id": "uuid-1234",
 *     "name": "新機能実装",
 *     "status": "running",
 *     "model": "claude-3-5-sonnet-20241022",
 *     "worktree_path": "/path/to/worktrees/session-1234567890",
 *     "branch_name": "session/session-1234567890",
 *     "created_at": "2025-12-13T09:00:00.000Z"
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
      include: {
        environment: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // フロントエンド用にフラット化した形式に変換
    const sessionWithEnvironment = {
      ...targetSession,
      environment_name: targetSession.environment?.name || null,
      environment_type: targetSession.environment?.type as 'HOST' | 'DOCKER' | 'SSH' | null,
      environment: undefined, // ネストされたオブジェクトは削除
    };

    logger.debug('Session retrieved', { id });
    return NextResponse.json({ session: sessionWithEnvironment });
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
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 204: 削除成功（レスポンスボディなし）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/sessions/session-uuid
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
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

/**
 * PATCH /api/sessions/[id] - セッション情報更新
 *
 * 指定されたIDのセッション情報を更新します。
 * 現在はセッション名の更新のみサポートしています。
 *
 * @param request - ボディにnameを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 更新成功（セッション情報を含む）
 * - 400: 名前が空またはバリデーションエラー
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * PATCH /api/sessions/session-uuid
 * Content-Type: application/json
 * { "name": "新しいセッション名" }
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "name": "新しいセッション名",
 *     ...
 *   }
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // リクエストボディの解析
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name } = body;

    // 名前のバリデーション
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // セッションが存在するか確認
    const existingSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // セッション名を更新
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { name: trimmedName },
    });

    logger.info('Session name updated', { id, name: trimmedName });
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to update session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
