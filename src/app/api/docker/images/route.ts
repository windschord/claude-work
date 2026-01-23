import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const execAsync = promisify(exec);

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
  created: string;
}

/**
 * GET /api/docker/images
 * ローカルDockerイメージ一覧を取得する
 */
export async function GET(): Promise<NextResponse> {
  try {
    logger.info('Fetching Docker images');

    const { stdout } = await execAsync('docker images --format "{{json .}}"', {
      timeout: 10000,
    });

    const images: DockerImage[] = stdout
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        const img = JSON.parse(line);
        return {
          repository: img.Repository,
          tag: img.Tag,
          id: img.ID,
          size: img.Size,
          created: img.CreatedAt,
        };
      })
      .filter((img) => img.repository !== '<none>' && img.tag !== '<none>');

    logger.info(`Found ${images.length} Docker images`);

    return NextResponse.json({ images });
  } catch (error) {
    logger.error('Failed to fetch Docker images', { error });

    return NextResponse.json(
      { error: 'Docker daemon not available' },
      { status: 503 }
    );
  }
}
