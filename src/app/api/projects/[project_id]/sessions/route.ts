import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';

const processManager = new ProcessManager();

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
    return NextResponse.json(sessions);
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to get sessions', { error, project_id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const body = await request.json();
    const { name, prompt, model = 'auto' } = body;

    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      );
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
    const worktreePath = gitService.createWorktree(sessionName, branchName);

    const newSession = await prisma.session.create({
      data: {
        project_id,
        name,
        status: 'running',
        model: model || project.default_model,
        worktree_path: worktreePath,
        branch_name: branchName,
      },
    });

    try {
      await processManager.startClaudeCode({
        sessionId: newSession.id,
        worktreePath,
        prompt,
        model: newSession.model,
      });

      logger.info('Session created', {
        id: newSession.id,
        name,
        project_id,
        worktree_path: worktreePath,
      });

      return NextResponse.json(newSession, { status: 201 });
    } catch (processError) {
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
