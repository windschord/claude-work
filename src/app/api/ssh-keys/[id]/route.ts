import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/ssh-keys/:id - SSH鍵を削除
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // SSH鍵の存在確認
    const existingKey = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.id, id))
      .get();

    if (!existingKey) {
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

    // 削除
    db.delete(schema.sshKeys).where(eq(schema.sshKeys.id, id)).run();

    logger.info('SSH key deleted', { keyId: id, keyName: existingKey.name });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
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
