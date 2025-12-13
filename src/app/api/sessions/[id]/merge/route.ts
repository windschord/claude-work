import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
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

    if (!commitMessage || typeof commitMessage !== 'string') {
      return NextResponse.json(
        { error: 'commitMessage is required and must be a string' },
        { status: 400 }
      );
    }

    // コミットメッセージから制御文字を除去（コマンドインジェクション対策の追加層）
    const sanitizedMessage = commitMessage.replace(/[\x00-\x1F\x7F]/g, ' ').trim();

    if (!sanitizedMessage) {
      return NextResponse.json(
        { error: 'commitMessage cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);

    const result = gitService.squashMerge(sessionName, sanitizedMessage);

    if (!result.success && result.conflicts) {
      logger.warn('Merge failed with conflicts', { id, conflicts: result.conflicts });
      return NextResponse.json(
        { success: false, conflicts: result.conflicts },
        { status: 409 }
      );
    }

    logger.info('Merged session successfully', { id, commitMessage: sanitizedMessage });
    return NextResponse.json({ success: true });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to merge session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
