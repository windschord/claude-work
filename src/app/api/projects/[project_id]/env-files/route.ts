import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { EnvFileService } from '@/services/env-file-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/[project_id]/env-files - .envファイル一覧取得
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    const project = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project_id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const files = await EnvFileService.listEnvFiles(
      project.path,
      project.clone_location,
      project.docker_volume_id,
    );

    return NextResponse.json({ files });
  } catch (error) {
    logger.error('Failed to list env files', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
