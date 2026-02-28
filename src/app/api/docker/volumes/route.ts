import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { DockerClient } from '@/services/docker-client';

interface DockerVolumeInfo {
  name: string;
  driver: string;
  createdAt: string;
}

/**
 * GET /api/docker/volumes
 * Docker Volume一覧を取得する
 */
export async function GET(): Promise<NextResponse> {
  try {
    logger.info('Fetching Docker volumes');

    const result = await DockerClient.getInstance().listVolumes();

    const volumes: DockerVolumeInfo[] = (result.Volumes ?? []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      createdAt: v.CreatedAt ?? '',
    }));

    logger.info(`Found ${volumes.length} Docker volumes`);

    return NextResponse.json({ volumes });
  } catch (error) {
    logger.error('Failed to fetch Docker volumes', { error });

    let errorMessage = 'Docker daemon not available';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 503 }
    );
  }
}
