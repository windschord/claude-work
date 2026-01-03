import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * POST /api/sessions/[id]/rebase - セッションのリベース
 *
 * 指定されたセッションのブランチをmainブランチからリベースします。
 * コンフリクトが発生した場合は409を返し、コンフリクトファイルのリストを含めます。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: リベース成功
 * - 404: セッションが見つからない
 * - 409: コンフリクトが発生（コンフリクトファイルのリストを含む）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/rebase
 *
 * // レスポンス（成功時）
 * { "success": true }
 *
 * // レスポンス（コンフリクト時）
 * {
 *   "success": false,
 *   "conflicts": ["src/app/component.tsx", "src/lib/utils.ts"]
 * }
 * ```
 */
export async function POST(
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

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const result = gitService.rebaseFromMain(sessionName);

    if (!result.success && result.conflicts) {
      logger.warn('Rebase failed with conflicts', { id, conflicts: result.conflicts });
      return NextResponse.json(result, { status: 409 });
    }

    logger.info('Rebased session successfully', { id });
    return NextResponse.json(result);
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to rebase session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
