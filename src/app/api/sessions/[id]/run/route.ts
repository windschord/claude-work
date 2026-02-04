import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { RunScriptManager } from '@/services/run-script-manager';
import { logger } from '@/lib/logger';

const runScriptManager = RunScriptManager.getInstance();

/**
 * POST /api/sessions/[id]/run - ランスクリプト実行
 *
 * 指定されたセッションのworktree内でランスクリプトを実行します。
 *
 * @param request - script_nameを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 202: ランスクリプト実行開始（run_idを返却）
 * - 400: script_nameが指定されていない
 * - 404: セッション、プロジェクト、またはスクリプトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/run
 * Content-Type: application/json
 * {
 *   "script_name": "test"
 * }
 *
 * // レスポンス
 * {
 *   "run_id": "run-uuid-1234"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: {
        project: true,
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
    const { script_name } = body;

    if (!script_name) {
      return NextResponse.json({ error: 'script_name is required' }, { status: 400 });
    }

    // Find the run script
    const runScript = await db.query.runScripts.findFirst({
      where: and(
        eq(schema.runScripts.project_id, targetSession.project_id),
        eq(schema.runScripts.name, script_name)
      ),
    });

    if (!runScript) {
      return NextResponse.json(
        { error: `Run script '${script_name}' not found` },
        { status: 404 }
      );
    }

    // Execute the script
    const runId = await runScriptManager.runScript({
      sessionId: targetSession.id,
      workingDirectory: targetSession.worktree_path,
      command: runScript.command,
    });

    logger.info('Run script started', {
      session_id: targetSession.id,
      run_id: runId,
      script_name,
      command: runScript.command,
    });

    return NextResponse.json({ run_id: runId }, { status: 202 });
  } catch (error) {
    let errorId = 'unknown';
    try {
      const resolvedParams = await params;
      errorId = resolvedParams.id;
    } catch {
      // params resolution failed, use default
    }
    logger.error('Failed to start run script', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
