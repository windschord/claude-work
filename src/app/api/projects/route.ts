import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { execSync } from 'child_process';
import { basename } from 'path';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      orderBy: { created_at: 'desc' },
    });

    logger.debug('Projects retrieved', { count: projects.length });
    return NextResponse.json(projects);
  } catch (error) {
    logger.error('Failed to get projects', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { path: projectPath } = body;

    if (!projectPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    try {
      execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'pipe' });
    } catch {
      logger.warn('Invalid git repository', { path: projectPath });
      return NextResponse.json({ error: 'Not a valid git repository' }, { status: 400 });
    }

    const name = basename(projectPath);

    const project = await prisma.project.create({
      data: {
        name,
        path: projectPath,
      },
    });

    logger.info('Project created', { id: project.id, name, path: projectPath });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Failed to create project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
