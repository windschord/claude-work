import { NextResponse } from 'next/server';
import { GitHubPATService } from '@/services/github-pat-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/github-pat - GitHub PAT一覧取得
 */
export async function GET() {
  try {
    const patService = new GitHubPATService();
    const pats = await patService.list();

    return NextResponse.json({ pats });
  } catch (error) {
    logger.error('Failed to list GitHub PATs', { error });
    return NextResponse.json(
      { error: 'GitHub PATの取得に失敗しました' },
      { status: 500 }
    );
  }
}
