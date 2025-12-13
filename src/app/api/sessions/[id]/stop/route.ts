import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = new ProcessManager();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id } = params;

    const targetSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Stop the process
    try {
      await processManager.stop(targetSession.id);
      logger.debug('Process stopped', { session_id: targetSession.id });
    } catch (error) {
      logger.warn('Failed to stop process', {
        error,
        session_id: targetSession.id,
      });
    }

    // Update session status to completed
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { status: 'completed' },
    });

    logger.info('Session stopped', { id });
    return NextResponse.json(updatedSession);
  } catch (error) {
    logger.error('Failed to stop session', { error, session_id: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
