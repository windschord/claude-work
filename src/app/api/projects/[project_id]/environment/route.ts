import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { validatePortMappings, validateVolumeMounts } from '@/lib/docker-config-validator';
import { validateChromeSidecarConfig } from '@/lib/chrome-sidecar-validator';
import { isHostEnvironmentAllowed } from '@/lib/environment-detect';
import type { PortMapping, VolumeMount } from '@/types/environment';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]/environment - プロジェクトの環境を取得
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
    const { project_id } = await params;
    const includeStatus = request.nextUrl.searchParams.get('includeStatus') === 'true';

    const environment = await environmentService.findByProjectId(project_id);

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // HOST環境の無効化フラグを付与
    const hostAllowed = isHostEnvironmentAllowed();
    const hostDisabled = environment.type === 'HOST' && !hostAllowed;
    const envWithDisabled = hostDisabled
      ? { ...environment, disabled: true }
      : environment;

    if (includeStatus) {
      const status = await environmentService.checkStatus(environment.id);
      return NextResponse.json({
        environment: { ...envWithDisabled, status },
        meta: { hostEnvironmentDisabled: !hostAllowed },
      });
    }

    return NextResponse.json({
      environment: envWithDisabled,
      meta: { hostEnvironmentDisabled: !hostAllowed },
    });
  } catch (error) {
    const { project_id } = await params;
    logger.error('Failed to get project environment', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[project_id]/environment - プロジェクトの環境設定を更新
 *
 * リクエストボディ:
 * - name: 環境名（任意）
 * - description: 説明（任意）
 * - config: 設定オブジェクト（任意）
 * - type: 環境タイプ（任意、HOST | DOCKER）
 *
 * @returns
 * - 200: 更新成功
 * - 400: バリデーションエラー
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // プロジェクトの環境を取得
    const existing = await environmentService.findByProjectId(project_id);
    if (!existing) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const { name, description, config, type } = body;

    // 更新内容があるかチェック
    if (name === undefined && description === undefined && config === undefined && type === undefined) {
      return NextResponse.json(
        { error: 'At least one field (name, description, config, type) must be provided' },
        { status: 400 }
      );
    }

    // 更新データを構築
    const updateData: { name?: string; description?: string | null; config?: object; type?: 'HOST' | 'DOCKER' } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: 'name must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' && description !== null) {
        return NextResponse.json(
          { error: 'description must be a string or null' },
          { status: 400 }
        );
      }
      updateData.description = description;
    }

    if (type !== undefined) {
      if (type !== 'HOST' && type !== 'DOCKER') {
        return NextResponse.json(
          { error: 'type must be HOST or DOCKER' },
          { status: 400 }
        );
      }
      // Docker内で動作している場合、HOST 環境への変更を禁止する
      if (type === 'HOST' && !isHostEnvironmentAllowed()) {
        return NextResponse.json(
          { error: 'HOST environment type is not allowed in this environment' },
          { status: 400 }
        );
      }
      updateData.type = type;
    }

    if (config !== undefined) {
      // config は plain object のみ許可（配列・null・プリミティブは拒否）
      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        return NextResponse.json(
          { error: 'config must be a plain object' },
          { status: 400 }
        );
      }

      // 既存 config をパースし、リクエストの更新キーのみマージする（丸ごと置き換えを防ぐ）
      // これにより imageSource, dockerfileUploaded 等、UIが送信しないキーが消えない
      let existingConfig: Record<string, unknown> = {};
      try {
        existingConfig = existing.config ? JSON.parse(existing.config) : {};
      } catch {
        logger.warn('既存の config が不正な JSON です。空オブジェクトとして扱います', {
          project_id,
          environmentId: existing.id,
        });
      }

      // 入力オブジェクトを直接ミューテーションしないようコピーを作成し、既存configとマージ
      const sanitizedConfig: Record<string, unknown> = { ...existingConfig, ...config };

      // skipPermissions のバリデーション
      if (sanitizedConfig.skipPermissions !== undefined) {
        const effectiveType = type ?? existing.type;
        if (effectiveType !== 'DOCKER') {
          delete sanitizedConfig.skipPermissions;
        } else if (typeof sanitizedConfig.skipPermissions !== 'boolean') {
          return NextResponse.json(
            { error: 'config.skipPermissions must be a boolean' },
            { status: 400 }
          );
        }
      }

      // portMappings のバリデーション
      if (sanitizedConfig.portMappings !== undefined) {
        if (!Array.isArray(sanitizedConfig.portMappings)) {
          return NextResponse.json(
            { error: 'config.portMappings must be an array' },
            { status: 400 }
          );
        }
        const portResult = validatePortMappings(sanitizedConfig.portMappings as PortMapping[]);
        if (!portResult.valid) {
          return NextResponse.json(
            { error: portResult.errors.join('; ') },
            { status: 400 }
          );
        }
      }

      // volumeMounts のバリデーション
      if (sanitizedConfig.volumeMounts !== undefined) {
        if (!Array.isArray(sanitizedConfig.volumeMounts)) {
          return NextResponse.json(
            { error: 'config.volumeMounts must be an array' },
            { status: 400 }
          );
        }
        const volumeResult = validateVolumeMounts(sanitizedConfig.volumeMounts as VolumeMount[]);
        if (!volumeResult.valid) {
          return NextResponse.json(
            { error: volumeResult.errors.join('; ') },
            { status: 400 }
          );
        }
      }

      // chromeSidecar のバリデーション（DOCKER環境の場合のみ）
      const effectiveType = type ?? existing.type;
      if (effectiveType === 'DOCKER') {
        const chromeSidecarError = validateChromeSidecarConfig(sanitizedConfig);
        if (chromeSidecarError) {
          return NextResponse.json(
            { error: chromeSidecarError },
            { status: 400 }
          );
        }
      }
      // HOST環境の場合はchromeSidecarを無視（エラーにはしない）

      updateData.config = sanitizedConfig;
    }

    logger.info('Updating project environment', { project_id, fields: Object.keys(updateData) });

    const environment = await environmentService.update(existing.id, updateData);

    // アクティブセッションの存在確認（警告メッセージのため）
    // HOST環境のセッションは container_id が null のため、session_state で判定する
    const activeSessions = db.select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.project_id, project_id),
          eq(schema.sessions.session_state, 'ACTIVE')
        )
      )
      .all();

    const response: { environment: typeof environment; warning?: string } = { environment };
    if (activeSessions.length > 0) {
      response.warning = 'アクティブセッションが存在します。次回セッション起動時に適用されます。';
    }

    logger.info('Project environment updated', { project_id, environmentId: existing.id });
    return NextResponse.json(response);
  } catch (error) {
    const { project_id } = await params;
    logger.error('Failed to update project environment', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
