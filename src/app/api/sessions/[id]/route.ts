import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = new ProcessManager();

export async function GET(
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

    logger.debug('Session retrieved', { id });
    return NextResponse.json(targetSession);
  } catch (error) {
    logger.error('Failed to get session', { error, session_id: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Stop process if running
    if (targetSession.status === 'running' || targetSession.status === 'waiting_input') {
      try {
        await processManager.stop(targetSession.id);
        logger.debug('Process stopped before deletion', { session_id: targetSession.id });
      } catch (error) {
        logger.warn('Failed to stop process before deletion', {
          error,
          session_id: targetSession.id,
        });
      }
    }

    // Remove worktree
    try {
      const gitService = new GitService(targetSession.project.path, logger);
      gitService.removeWorktree(targetSession.worktree_path);
      logger.debug('Worktree removed', { worktree_path: targetSession.worktree_path });
    } catch (error) {
      logger.warn('Failed to remove worktree', {
        error,
        worktree_path: targetSession.worktree_path,
      });
    }

    // Delete session from database
    await prisma.session.delete({
      where: { id },
    });

    logger.info('Session deleted', { id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to delete session', { error, session_id: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
