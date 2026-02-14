import { NextRequest, NextResponse } from 'next/server';
import { GitHubPATService } from '@/services/github-pat-service';
import { logger } from '@/lib/logger';
import { validatePATName, validatePATFormat } from '@/lib/validation';

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

/**
 * POST /api/github-pat - GitHub PAT作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, token, description } = body;

    if (!name || !token) {
      return NextResponse.json(
        { error: '名前とトークンは必須です' },
        { status: 400 }
      );
    }

    const nameValidation = validatePATName(name);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.errors.join(', ') },
        { status: 400 }
      );
    }

    const tokenValidation = validatePATFormat(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { error: tokenValidation.errors.join(', ') },
        { status: 400 }
      );
    }

    const patService = new GitHubPATService();
    const pat = await patService.create({ name, token, description });

    return NextResponse.json(pat, { status: 201 });
  } catch (error) {
    logger.error('Failed to create GitHub PAT', { error });
    return NextResponse.json(
      { error: 'GitHub PATの作成に失敗しました' },
      { status: 500 }
    );
  }
}
