import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { environmentService } from '@/services/environment-service';
import { getEnvironmentsDir } from '@/lib/data-dir';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * POST /api/projects/[project_id]/environment/dockerfile - Dockerfileをアップロード
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { project_id } = await params;

  const environment = await environmentService.findByProjectId(project_id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile upload is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('dockerfile') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No dockerfile provided' }, { status: 400 });
  }

  const envDir = path.join(getEnvironmentsDir(), environment.id);
  await fs.mkdir(envDir, { recursive: true });

  const dockerfilePath = path.join(envDir, 'Dockerfile');
  const fileContent = await file.text();
  await fs.writeFile(dockerfilePath, fileContent, 'utf-8');

  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = true;
  config.imageSource = 'dockerfile';

  await environmentService.update(environment.id, { config });

  return NextResponse.json({
    success: true,
    path: `environments/${environment.id}/Dockerfile`,
  });
}

/**
 * DELETE /api/projects/[project_id]/environment/dockerfile - Dockerfileを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { project_id } = await params;

  const environment = await environmentService.findByProjectId(project_id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile delete is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  const dockerfilePath = path.join(getEnvironmentsDir(), environment.id, 'Dockerfile');
  try {
    await fs.unlink(dockerfilePath);
  } catch {
    // ファイルが存在しなくてもOK
  }

  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = false;
  config.imageSource = 'existing';

  await environmentService.update(environment.id, { config });

  return NextResponse.json({ success: true });
}
