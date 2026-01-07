import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/services/session-manager';
import { DockerService } from '@/services/docker-service';
import { logger } from '@/lib/logger';

const sessionManager = new SessionManager();
const dockerService = new DockerService();

/**
 * GET /api/sessions/[id]/warning - セッション警告情報取得
 *
 * セッションのGit状態をチェックし、未コミットの変更やプッシュされていないコミットがあるかを返します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 警告情報
 * - 400: コンテナが起動していない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await sessionManager.findById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.containerId) {
      return NextResponse.json(
        { error: 'Container is not running' },
        { status: 400 }
      );
    }

    // Check for uncommitted changes
    const statusResult = await dockerService.execCommand(
      session.containerId,
      ['git', 'status', '--porcelain'],
      '/workspace'
    );

    const hasUncommittedChanges = statusResult.exitCode === 0 && statusResult.output.trim() !== '';

    // Check for unpushed commits
    const unpushedResult = await dockerService.execCommand(
      session.containerId,
      ['git', 'rev-list', '--count', `origin/${session.branch}..HEAD`],
      '/workspace'
    );

    let unpushedCommitCount = 0;
    if (unpushedResult.exitCode === 0) {
      unpushedCommitCount = parseInt(unpushedResult.output.trim(), 10) || 0;
    }

    logger.info('Session warning checked', {
      id,
      hasUncommittedChanges,
      unpushedCommitCount,
    });

    return NextResponse.json({
      warning: {
        hasUncommittedChanges,
        unpushedCommitCount,
      },
    });
  } catch (error) {
    const { id: errorId } = await params;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get session warning', { error: errorMessage, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
