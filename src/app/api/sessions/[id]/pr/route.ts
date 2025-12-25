import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { execSync } from 'child_process';

/**
 * POST /api/sessions/[id]/pr - GitHub PRを作成
 *
 * 指定されたセッションのブランチからGitHub PRを作成します。
 * ブランチが未プッシュの場合は自動的にプッシュします。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキー
 * @param params.id - セッションID
 *
 * @returns
 * - 201: PR作成成功（pr_urlを含む）
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 400: PR作成失敗（ghコマンドエラー）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/pr
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス（成功時）
 * { "success": true, "pr_url": "https://github.com/owner/repo/pull/123" }
 *
 * // レスポンス（エラー時）
 * { "error": "PR作成に失敗しました", "details": "エラー詳細" }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetSession = await prisma.session.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { branch_name, name: sessionName, worktree_path } = targetSession;

    // ブランチをリモートにプッシュ
    try {
      execSync(`git push -u origin ${branch_name}`, {
        cwd: worktree_path,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      logger.info('Pushed branch to remote', { id, branch_name });
    } catch (pushError) {
      // already up to date の場合は無視
      const errorMessage = pushError instanceof Error ? pushError.message : String(pushError);
      if (!errorMessage.includes('Everything up-to-date')) {
        logger.warn('Push may have failed, continuing with PR creation', { id, error: errorMessage });
      }
    }

    // gh pr create コマンドを実行
    const prTitle = sessionName;
    const prBody = `Created from ClaudeWork session: ${sessionName}`;

    try {
      const prOutput = execSync(
        `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --head ${branch_name}`,
        {
          cwd: worktree_path,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // gh pr create の出力からPR URLを抽出（最後の行がURL）
      const prUrl = prOutput.trim().split('\n').pop() || '';

      if (!prUrl.startsWith('https://')) {
        logger.error('Failed to extract PR URL from gh output', { id, output: prOutput });
        return NextResponse.json(
          { error: 'PR作成に失敗しました', details: 'PR URLを取得できませんでした' },
          { status: 400 }
        );
      }

      logger.info('Created PR successfully', { id, pr_url: prUrl });
      return NextResponse.json({ success: true, pr_url: prUrl }, { status: 201 });
    } catch (ghError) {
      const errorMessage = ghError instanceof Error ? ghError.message : String(ghError);

      // 既存のPRがある場合のエラーハンドリング
      if (errorMessage.includes('already exists')) {
        logger.warn('PR already exists for this branch', { id, branch_name });
        return NextResponse.json(
          { error: 'PR作成に失敗しました', details: 'このブランチのPRは既に存在します' },
          { status: 400 }
        );
      }

      logger.error('Failed to create PR', { id, error: errorMessage });
      return NextResponse.json(
        { error: 'PR作成に失敗しました', details: errorMessage },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Failed to create PR', { error, session_id: id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
