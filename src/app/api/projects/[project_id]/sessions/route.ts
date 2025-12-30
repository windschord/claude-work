import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';
import { generateUniqueSessionName } from '@/lib/session-name-generator';

const processManager = ProcessManager.getInstance();

/**
 * GET /api/projects/[project_id]/sessions - プロジェクトのセッション一覧取得
 *
 * 指定されたプロジェクトに属するすべてのセッションを作成日時の降順で取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 200: セッション一覧（統一形式）
 * - 401: 認証されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects/uuid-1234/sessions
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "sessions": [
 *     {
 *       "id": "session-uuid",
 *       "project_id": "uuid-1234",
 *       "name": "新機能実装",
 *       "status": "running",
 *       "model": "claude-3-5-sonnet-20241022",
 *       "worktree_path": "/path/to/worktrees/session-1234567890",
 *       "branch_name": "session/session-1234567890",
 *       "created_at": "2025-12-13T09:00:00.000Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
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

    const sessions = await prisma.session.findMany({
      where: { project_id },
      orderBy: { created_at: 'desc' },
    });

    logger.debug('Sessions retrieved', { project_id, count: sessions.length });
    return NextResponse.json({ sessions });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to get sessions', { error, project_id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[project_id]/sessions - 新規セッション作成
 *
 * 指定されたプロジェクトに新しいセッションを作成します。
 * Git worktreeとブランチが自動的に作成され、Claude Codeプロセスが起動されます。
 * セッション名が未指定の場合は「形容詞-動物名」形式で自動生成されます。
 * 認証が必要です。
 *
 * @param request - リクエストボディに`prompt`（必須）、`name`（オプション、未指定時は自動生成）、`model`（オプション）を含むJSON、sessionIdクッキー
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 201: セッション作成成功
 * - 400: nameまたはpromptが指定されていない
 * - 401: 認証されていない
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects/uuid-1234/sessions
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * {
 *   "name": "新機能実装",
 *   "prompt": "ユーザー認証機能を実装してください",
 *   "model": "claude-3-5-sonnet-20241022"
 * }
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

    const { name, prompt, model = 'auto' } = body;

    // プロンプトのみ必須（nameは任意、未指定時は自動生成）
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // セッション名が未指定の場合は一意な名前を自動生成
    let sessionDisplayName: string;
    if (name?.trim()) {
      sessionDisplayName = name.trim();
      // ユーザー指定の名前も重複チェック
      const existingSession = await prisma.session.findFirst({
        where: { project_id, name: sessionDisplayName },
      });
      if (existingSession) {
        return NextResponse.json(
          { error: 'Session name already exists in this project' },
          { status: 400 }
        );
      }
    } else {
      // 既存のセッション名を取得して重複を避ける
      const existingSessions = await prisma.session.findMany({
        where: { project_id },
        select: { name: true },
      });
      const existingNames = existingSessions.map((s) => s.name);
      sessionDisplayName = generateUniqueSessionName(existingNames);
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const timestamp = Date.now();
    const sessionName = `session-${timestamp}`;
    const branchName = `session/${sessionName}`;

    const gitService = new GitService(project.path, logger);
    let worktreePath: string;

    try {
      worktreePath = gitService.createWorktree(sessionName, branchName);
    } catch (worktreeError) {
      logger.error('Failed to create worktree', {
        error: worktreeError,
        project_id,
        sessionName,
      });
      throw worktreeError;
    }

    const newSession = await prisma.session.create({
      data: {
        project_id,
        name: sessionDisplayName,
        status: 'running',
        model: model || project.default_model,
        worktree_path: worktreePath,
        branch_name: branchName,
      },
    });

    // プロンプトを保存または更新
    const existingPrompt = await prisma.prompt.findFirst({
      where: { content: prompt },
    });

    if (existingPrompt) {
      await prisma.prompt.update({
        where: { id: existingPrompt.id },
        data: {
          used_count: { increment: 1 },
          last_used_at: new Date(),
        },
      });
    } else {
      await prisma.prompt.create({
        data: {
          content: prompt,
          used_count: 1,
          last_used_at: new Date(),
        },
      });
    }

    try {
      // 初期プロンプトをユーザーメッセージとして保存
      await prisma.message.create({
        data: {
          session_id: newSession.id,
          role: 'user',
          content: prompt,
        },
      });

      await processManager.startClaudeCode({
        sessionId: newSession.id,
        worktreePath,
        prompt,
        model: newSession.model,
      });

      logger.info('Session created', {
        id: newSession.id,
        name: sessionDisplayName,
        project_id,
        worktree_path: worktreePath,
      });

      return NextResponse.json({ session: newSession }, { status: 201 });
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
      });

      throw processError;
    }
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to create session', { error, project_id: errorProjectId });

    // 開発環境では詳細なエラーメッセージを返す
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json(
        {
          error: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
