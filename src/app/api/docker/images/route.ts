import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { DockerClient } from '@/services/docker-client';

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
  created: string;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)}${units[i]}`;
}

function formatDate(timestamp: number): string {
  // Docker returns unix timestamp (seconds). JS expects milliseconds.
  return new Date(timestamp * 1000).toISOString();
}

/**
 * GET /api/docker/images
 * ローカルDockerイメージ一覧を取得する
 */
export async function GET(): Promise<NextResponse> {
  try {
    logger.info('Fetching Docker images');

    const imageInfos = await DockerClient.getInstance().listImages();

    const images: DockerImage[] = [];
    
    for (const info of imageInfos) {
      if (!info.RepoTags) continue;
      
      for (const repoTag of info.RepoTags) {
        const lastColon = repoTag.lastIndexOf(':');
        if (lastColon === -1) continue;
        const repository = repoTag.substring(0, lastColon);
        const tag = repoTag.substring(lastColon + 1);
        if (repository === '<none>' || tag === '<none>') continue;
        
        images.push({
          repository,
          tag,
          id: info.Id.replace('sha256:', '').substring(0, 12), // Short ID format usually expected
          size: formatSize(info.Size),
          created: formatDate(info.Created),
        });
      }
    }

    logger.info(`Found ${images.length} Docker images`);

    return NextResponse.json({ images });
  } catch (error) {
    logger.error('Failed to fetch Docker images', { error });

    // エラータイプに応じたメッセージを返す
    let errorMessage = 'Docker daemon not available';
    if (error instanceof Error) {
        // dockerode errors might differ
        errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 503 }
    );
  }
}
