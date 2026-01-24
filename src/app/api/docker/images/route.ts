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
      maxBuffer: 10 * 1024 * 1024, // 10MB バッファ（大量イメージ対応）
    });

    const images: DockerImage[] = stdout
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        try {
          const img = JSON.parse(line);
          return {
            repository: img.Repository,
            tag: img.Tag,
            id: img.ID,
            size: img.Size,
            created: img.CreatedAt,
          };
        } catch {
          // 不正なJSON行（ビルド中イメージの警告など）はスキップ
          logger.debug('Skipping invalid JSON line in docker images output', { line });
          return null;
        }
      })
      .filter((img): img is DockerImage => img !== null && img.repository !== '<none>' && img.tag !== '<none>');

    logger.info(`Found ${images.length} Docker images`);

    return NextResponse.json({ images });
  } catch (error) {
    logger.error('Failed to fetch Docker images', { error });

    // エラータイプに応じたメッセージを返す
    let errorMessage = 'Docker daemon not available';
    if (error instanceof Error) {
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        errorMessage = 'Docker command timed out';
      } else if (error.message.includes('ENOENT')) {
        errorMessage = 'Docker command not found';
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 503 }
    );
  }
}
