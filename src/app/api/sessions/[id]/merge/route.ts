import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { spawnSync } from 'child_process';
import { basename } from 'path';

/**
 * POST /api/sessions/[id]/merge - セッションのマージ
 *
 * 指定されたセッションのブランチをmainブランチにスカッシュマージします。
 * コンフリクトが発生した場合は409を返し、コンフリクトファイルのリストを含めます。
 * 認証が必要です。
 *
 * @param request - リクエストボディに`commitMessage`を含むJSON、sessionIdクッキー
 * @param params.id - セッションID
 *
 * @returns
 * - 200: マージ成功
 * - 400: commitMessageが指定されていない
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 409: コンフリクトが発生（コンフリクトファイルのリストを含む）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト（成功時）
 * POST /api/sessions/session-uuid/merge
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * { "commitMessage": "新機能を実装" }
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

    const body = await request.json();
    const { commitMessage } = body;

    if (!commitMessage) {
      return NextResponse.json(
        { error: 'commitMessage is required' },
        { status: 400 }
      );
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);

    try {
      gitService.squashMerge(sessionName, commitMessage);
      logger.info('Merged session successfully', { id, commitMessage });
      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      const err = error as { message?: string; toString?: () => string };
      const errorMessage = err?.message || err?.toString?.() || '';

      if (errorMessage.includes('CONFLICT') || errorMessage.includes('conflict')) {
        try {
          const conflictsResult = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
            cwd: targetSession.project.path,
            encoding: 'utf-8',
          });

          const conflicts = (conflictsResult.stdout || '')
            .split('\n')
            .filter((file) => file.length > 0);

          spawnSync('git', ['reset', '--merge'], {
            cwd: targetSession.project.path,
          });

          logger.warn('Merge failed with conflicts', { id, conflicts });
          return NextResponse.json(
            { success: false, conflicts },
            { status: 409 }
          );
        } catch (abortError) {
          logger.error('Failed to handle merge conflict', { id, error: abortError });
          throw abortError;
        }
      }

      throw error;
    }
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to merge session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
