import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { environmentService } from '@/services/environment-service';
import { getEnvironmentsDir } from '@/lib/data-dir';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 環境の取得と検証
  const environment = await environmentService.findById(id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }
  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile upload is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  // multipart/form-dataからファイルを取得
  const formData = await request.formData();
  const file = formData.get('dockerfile') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No dockerfile provided' }, { status: 400 });
  }

  // 環境専用ディレクトリにDockerfileを保存
  const envDir = path.join(getEnvironmentsDir(), id);
  await fs.mkdir(envDir, { recursive: true });

  const dockerfilePath = path.join(envDir, 'Dockerfile');
  const fileContent = await file.text();
  await fs.writeFile(dockerfilePath, fileContent, 'utf-8');

  // 環境のconfigを更新
  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = true;
  config.imageSource = 'dockerfile';

  await environmentService.update(id, { config });

  return NextResponse.json({
    success: true,
    path: `environments/${id}/Dockerfile`,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const environment = await environmentService.findById(id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }
  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile delete is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  // Dockerfileを削除
  const dockerfilePath = path.join(getEnvironmentsDir(), id, 'Dockerfile');
  try {
    await fs.unlink(dockerfilePath);
  } catch {
    // ファイルが存在しなくてもOK
  }

  // 環境のconfigを更新
  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = false;
  config.imageSource = 'existing';

  await environmentService.update(id, { config });

  return NextResponse.json({ success: true });
}
