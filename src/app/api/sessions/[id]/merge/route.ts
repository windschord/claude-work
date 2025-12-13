import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { execSync } from 'child_process';
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

    const body = await request.json();
    const { commitMessage } = body;

    if (!commitMessage) {
      return NextResponse.json(
        { error: 'commitMessage is required' },
        { status: 400 }
      );
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);

    try {
      gitService.squashMerge(sessionName, commitMessage);
      logger.info('Merged session successfully', { id, commitMessage });
      return NextResponse.json({ success: true });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '';
      const errorStdout = error?.stdout?.toString() || '';

      if (errorMessage.includes('CONFLICT') || errorStdout.includes('CONFLICT')) {
        try {
          const conflictsOutput = execSync('git diff --name-only --diff-filter=U', {
            cwd: targetSession.project.path,
            encoding: 'utf-8',
          });

          const conflicts = conflictsOutput
            .split('\n')
            .filter((file) => file.length > 0);

          execSync('git reset --merge', {
            cwd: targetSession.project.path,
          });

          logger.warn('Merge failed with conflicts', { id, conflicts });
          return NextResponse.json(
            { success: false, conflicts },
            { status: 409 }
          );
        } catch (abortError) {
          logger.error('Failed to handle merge conflict', { id, error: abortError });
          throw abortError;
        }
      }

      throw error;
    }
  } catch (error) {
    logger.error('Failed to merge session', { error, session_id: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
