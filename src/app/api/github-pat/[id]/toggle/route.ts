import { NextRequest, NextResponse } from 'next/server';
import { GitHubPATService, PATNotFoundError } from '@/services/github-pat-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/github-pat/:id/toggle - GitHub PAT有効/無効切り替え
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patService = new GitHubPATService();
    const pat = await patService.toggleActive(id);

    return NextResponse.json({ pat });
  } catch (error) {
    if (error instanceof PATNotFoundError) {
      return NextResponse.json(
        { error: 'PATが見つかりません' },
        { status: 404 }
      );
    }
    logger.error('Failed to toggle GitHub PAT', { error });
    return NextResponse.json(
      { error: 'GitHub PATの切り替えに失敗しました' },
      { status: 500 }
    );
  }
}
