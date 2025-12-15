import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = ProcessManager.getInstance();

/**
 * POST /api/projects/[project_id]/sessions/bulk - 一括セッション作成
 *
 * 指定されたプロジェクトに複数のセッションを一括作成します。
 * 各セッションにはGit worktreeとブランチが自動的に作成され、Claude Codeプロセスが起動されます。
 * 認証が必要です。
 *
 * @param request - リクエストボディに`name`、`prompt`、`model`（オプション）、`count`を含むJSON、sessionIdクッキー
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 201: セッション作成成功（作成されたセッションの配列）
 * - 400: nameまたはpromptまたはcountが指定されていない、またはcountが2-10の範囲外
 * - 401: 認証されていない
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects/uuid-1234/sessions/bulk
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * {
 *   "name": "新機能実装",
 *   "prompt": "ユーザー認証機能を実装してください",
 *   "model": "claude-3-5-sonnet-20241022",
 *   "count": 3
 * }
 *
 * // レスポンス
 * {
 *   "sessions": [
 *     {
 *       "id": "session-uuid-1",
 *       "project_id": "uuid-1234",
 *       "name": "新機能実装-1",
 *       "status": "running",
 *       "model": "claude-3-5-sonnet-20241022",
 *       "worktree_path": "/path/to/worktrees/session-1",
 *       "branch_name": "session/session-1",
 *       "created_at": "2025-12-15T09:00:00.000Z"
 *     },
 *     {
 *       "id": "session-uuid-2",
 *       "project_id": "uuid-1234",
 *       "name": "新機能実装-2",
 *       "status": "running",
 *       "model": "claude-3-5-sonnet-20241022",
 *       "worktree_path": "/path/to/worktrees/session-2",
 *       "branch_name": "session/session-2",
 *       "created_at": "2025-12-15T09:00:01.000Z"
 *     },
 *     {
 *       "id": "session-uuid-3",
 *       "project_id": "uuid-1234",
 *       "name": "新機能実装-3",
 *       "status": "running",
 *       "model": "claude-3-5-sonnet-20241022",
 *       "worktree_path": "/path/to/worktrees/session-3",
 *       "branch_name": "session/session-3",
 *       "created_at": "2025-12-15T09:00:02.000Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
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

    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name, prompt, model = 'auto', count } = body;

    if (!name || !prompt || !count) {
      return NextResponse.json(
        { error: 'Name, prompt, and count are required' },
        { status: 400 }
      );
    }

    if (count < 2 || count > 10) {
      return NextResponse.json(
        { error: 'Count must be between 2 and 10' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const gitService = new GitService(project.path, logger);
    const sessions = [];
    const createdWorktrees: string[] = [];

    // count個のセッションを作成
    for (let i = 1; i <= count; i++) {
      const timestamp = Date.now() + i; // 各セッションでユニークなタイムスタンプを確保
      const sessionName = `session-${timestamp}`;
      const branchName = `session/${sessionName}`;
      const displayName = `${name}-${i}`;

      let worktreePath: string;

      try {
        worktreePath = gitService.createWorktree(sessionName, branchName);
        createdWorktrees.push(sessionName);
      } catch (worktreeError) {
        logger.error('Failed to create worktree', {
          error: worktreeError,
          project_id,
          sessionName,
          index: i,
        });

        // 失敗した場合、作成済みのworktreeをクリーンアップ
        for (const createdWorktree of createdWorktrees) {
          try {
            gitService.deleteWorktree(createdWorktree);
          } catch (cleanupError) {
            logger.error('Failed to cleanup worktree', {
              error: cleanupError,
              worktree: createdWorktree,
            });
          }
        }

        // 作成済みのセッションはそのまま残す（エラー処理方針に従う）
        if (sessions.length > 0) {
          logger.info('Partial bulk sessions created', {
            project_id,
            successCount: sessions.length,
            failedAt: i,
          });
          return NextResponse.json({ sessions }, { status: 201 });
        }

        throw worktreeError;
      }

      const newSession = await prisma.session.create({
        data: {
          project_id,
          name: displayName,
          status: 'running',
          model: model || project.default_model,
          worktree_path: worktreePath,
          branch_name: branchName,
        },
      });

      try {
        await processManager.startClaudeCode({
          sessionId: newSession.id,
          worktreePath,
          prompt,
          model: newSession.model,
        });

        sessions.push(newSession);

        logger.info('Bulk session created', {
          id: newSession.id,
          name: displayName,
          project_id,
          worktree_path: worktreePath,
          index: i,
        });
      } catch (processError) {
        // プロセス起動失敗時はworktreeをクリーンアップ
        gitService.deleteWorktree(sessionName);

        await prisma.session.update({
          where: { id: newSession.id },
          data: { status: 'error' },
        });

        logger.error('Failed to start Claude Code process', {
          error: processError,
          session_id: newSession.id,
          index: i,
        });

        // 作成済みのセッションはそのまま残す
        if (sessions.length > 0) {
          logger.info('Partial bulk sessions created', {
            project_id,
            successCount: sessions.length,
            failedAt: i,
          });
          return NextResponse.json({ sessions }, { status: 201 });
        }

        throw processError;
      }
    }

    logger.info('Bulk sessions created', {
      project_id,
      count: sessions.length,
    });

    return NextResponse.json({ sessions }, { status: 201 });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to create bulk sessions', { error, project_id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
