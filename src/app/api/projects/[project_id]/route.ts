import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function PUT(
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

    const existing = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id: project_id },
      data: {
        name: body.name ?? existing.name,
        default_model: body.default_model ?? existing.default_model,
        run_scripts: body.run_scripts ?? existing.run_scripts,
      },
    });

    logger.info('Project updated', { id: project_id, name: project.name });
    return NextResponse.json(project);
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to update project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id: project_id },
    });

    logger.info('Project deleted', { id: project_id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to delete project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
