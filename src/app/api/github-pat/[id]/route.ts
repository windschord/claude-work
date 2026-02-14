import { NextRequest, NextResponse } from 'next/server';
import { GitHubPATService, PATNotFoundError } from '@/services/github-pat-service';
import { logger } from '@/lib/logger';
import { validatePATName, validatePATFormat } from '@/lib/validation';

/**
 * PATCH /api/github-pat/:id - GitHub PAT更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, token, description } = body;

    if (name !== undefined) {
      const nameValidation = validatePATName(name);
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: nameValidation.errors.join(', ') },
          { status: 400 }
        );
      }
    }

    if (token !== undefined) {
      const tokenValidation = validatePATFormat(token);
      if (!tokenValidation.valid) {
        return NextResponse.json(
          { error: tokenValidation.errors.join(', ') },
          { status: 400 }
        );
      }
    }

    const patService = new GitHubPATService();
    const pat = await patService.update(id, { name, token, description });

    return NextResponse.json({ pat });
  } catch (error) {
    if (error instanceof PATNotFoundError) {
      return NextResponse.json(
        { error: 'PATが見つかりません' },
        { status: 404 }
      );
    }
    logger.error('Failed to update GitHub PAT', { error });
    return NextResponse.json(
      { error: 'GitHub PATの更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/github-pat/:id - GitHub PAT削除
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const patService = new GitHubPATService();
    await patService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PATNotFoundError) {
      return NextResponse.json(
        { error: 'PATが見つかりません' },
        { status: 404 }
      );
    }
    logger.error('Failed to delete GitHub PAT', { error });
    return NextResponse.json(
      { error: 'GitHub PATの削除に失敗しました' },
      { status: 500 }
    );
  }
}
