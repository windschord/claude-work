import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function createDeprecatedResponse() {
  return NextResponse.json(
    {
      error: 'このエンドポイントは廃止されました。環境はプロジェクトに1対1で紐付けられます。',
      deprecated: true,
      alternatives: {
        'GET /api/environments/:id': 'GET /api/projects/[project_id]/environment',
        'PUT /api/environments/:id': 'PUT /api/projects/[project_id]/environment',
        'DELETE /api/environments/:id': 'プロジェクト削除時に自動削除されます（DELETE /api/projects/[project_id]）',
      },
    },
    {
      status: 410,
      headers: {
        'Deprecation': 'true',
        'Link': '</api/projects/{project_id}/environment>; rel="successor-version"',
      },
    }
  );
}

/**
 * @deprecated GET /api/environments/:id は廃止されました（410 Gone）。
 * GET /api/projects/[project_id]/environment を使用してください。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest, _params: RouteParams) {
  return createDeprecatedResponse();
}

/**
 * @deprecated PUT /api/environments/:id は廃止されました（410 Gone）。
 * PUT /api/projects/[project_id]/environment を使用してください。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function PUT(_request: NextRequest, _params: RouteParams) {
  return createDeprecatedResponse();
}

/**
 * @deprecated DELETE /api/environments/:id は廃止されました（410 Gone）。
 * 環境はプロジェクト削除時に自動削除されます（DELETE /api/projects/[project_id]）。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function DELETE(_request: NextRequest, _params: RouteParams) {
  return createDeprecatedResponse();
}
