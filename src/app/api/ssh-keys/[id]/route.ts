import { NextRequest, NextResponse } from 'next/server';
import { SshKeyService, SshKeyNotFoundError } from '@/services/ssh-key-service';
import { logger } from '@/lib/logger';

const service = new SshKeyService();

/**
 * DELETE /api/ssh-keys/:id - SSH鍵を削除
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'id は必須です',
          },
        },
        { status: 400 }
      );
    }

    await service.deleteKey(id);

    return NextResponse.json(
      { message: 'SSH鍵を削除しました' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SshKeyNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'SSH鍵が見つかりません',
          },
        },
        { status: 404 }
      );
    }

    logger.error('Failed to delete SSH key', { error });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
        },
      },
      { status: 500 }
    );
  }
}
