import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { logger } from '@/lib/logger';
import { validatePortMappings, validateVolumeMounts } from '@/lib/docker-config-validator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/environments/:id - 環境を取得
 *
 * クエリパラメータ:
 * - includeStatus=true: ステータスを含める
 *
 * @returns
 * - 200: 環境情報
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const includeStatus = request.nextUrl.searchParams.get('includeStatus') === 'true';

    const environment = await environmentService.findById(id);

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    if (includeStatus) {
      const status = await environmentService.checkStatus(id);
      return NextResponse.json({ environment: { ...environment, status } });
    }

    return NextResponse.json({ environment });
  } catch (error) {
    const { id } = await params;
    logger.error('Failed to get environment', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/environments/:id - 環境を更新
 *
 * リクエストボディ:
 * - name: 環境名（任意）
 * - description: 説明（任意）
 * - config: 設定オブジェクト（任意）
 *
 * 注: typeは変更不可
 *
 * @returns
 * - 200: 更新成功
 * - 400: バリデーションエラー
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // 環境の存在チェック
    const existing = await environmentService.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const { name, description, config } = body;

    // 更新内容があるかチェック
    if (name === undefined && description === undefined && config === undefined) {
      return NextResponse.json(
        { error: 'At least one field (name, description, config) must be provided' },
        { status: 400 }
      );
    }

    // 更新データを構築
    const updateData: { name?: string; description?: string; config?: object } = {};
    if (name !== undefined) {
      // 空文字列チェック
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: 'name must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (config !== undefined) {
      // skipPermissions のバリデーション（Docker環境のみ）
      if (config?.skipPermissions !== undefined) {
        if (existing.type !== 'DOCKER') {
          // Docker以外の環境では skipPermissions を削除
          delete config.skipPermissions;
        } else if (typeof config.skipPermissions !== 'boolean') {
          return NextResponse.json(
            { error: 'config.skipPermissions must be a boolean' },
            { status: 400 }
          );
        }
      }
      // portMappings のバリデーション
      if (config?.portMappings !== undefined) {
        if (!Array.isArray(config.portMappings)) {
          return NextResponse.json(
            { error: 'config.portMappings must be an array' },
            { status: 400 }
          );
        }
        const portResult = validatePortMappings(config.portMappings);
        if (!portResult.valid) {
          return NextResponse.json(
            { error: portResult.errors.join('; ') },
            { status: 400 }
          );
        }
      }

      // volumeMounts のバリデーション
      if (config?.volumeMounts !== undefined) {
        if (!Array.isArray(config.volumeMounts)) {
          return NextResponse.json(
            { error: 'config.volumeMounts must be an array' },
            { status: 400 }
          );
        }
        const volumeResult = validateVolumeMounts(config.volumeMounts);
        if (!volumeResult.valid) {
          return NextResponse.json(
            { error: volumeResult.errors.join('; ') },
            { status: 400 }
          );
        }
      }

      updateData.config = config;
    }

    logger.info('Updating environment', { id, fields: Object.keys(updateData) });

    const environment = await environmentService.update(id, updateData);

    logger.info('Environment updated', { id });
    return NextResponse.json({ environment });
  } catch (error) {
    const { id } = await params;
    logger.error('Failed to update environment', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/environments/:id - 環境を削除
 *
 * 注:
 * - デフォルト環境は削除不可
 * - 使用中のセッションがあっても削除は許可（警告をログ出力）
 *
 * @returns
 * - 200: 削除成功
 * - 400: デフォルト環境は削除不可
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 環境の存在チェック
    const environment = await environmentService.findById(id);
    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // デフォルト環境は削除不可
    if (environment.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete default environment' },
        { status: 400 }
      );
    }

    logger.info('Deleting environment', { id, name: environment.name });

    await environmentService.delete(id);

    logger.info('Environment deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await params;
    logger.error('Failed to delete environment', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
