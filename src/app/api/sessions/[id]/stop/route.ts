import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/services/session-manager';
import { ContainerManager } from '@/services/container-manager';
import { logger } from '@/lib/logger';

const sessionManager = new SessionManager();
const containerManager = new ContainerManager();

/**
 * POST /api/sessions/[id]/stop - セッション停止
 *
 * 実行中のセッションを停止します。
 * Dockerコンテナが停止されます。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション停止成功
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await sessionManager.findById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await containerManager.stopSession(id);

    logger.info('Session stopped via API', { id });
    return NextResponse.json({ message: 'Session stopped' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to stop session', { error: errorMessage, session_id: id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
