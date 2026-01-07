import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/services/session-manager';
import { ContainerManager } from '@/services/container-manager';
import { logger } from '@/lib/logger';

const sessionManager = new SessionManager();
const containerManager = new ContainerManager();

/**
 * POST /api/sessions/[id]/start - セッション開始
 *
 * 停止中のセッションを開始します。
 * Dockerコンテナが再起動されます。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション開始成功
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await sessionManager.findById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await containerManager.startSession(id);

    logger.info('Session started via API', { id });
    return NextResponse.json({ message: 'Session started' });
  } catch (error) {
    const { id: errorId } = await params;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start session', { error: errorMessage, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
