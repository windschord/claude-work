import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

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
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const result = gitService.rebaseFromMain(sessionName);

    if (!result.success && result.conflicts) {
      logger.warn('Rebase failed with conflicts', { id, conflicts: result.conflicts });
      return NextResponse.json(result, { status: 409 });
    }

    logger.info('Rebased session successfully', { id });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to rebase session', { error, session_id: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
