import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated このエンドポイントは廃止されました（410 Gone）。
 *
 * 環境はプロジェクトに1対1で紐付けられます。
 * - 環境の一覧取得: GET /api/projects/[project_id]/environment
 * - 環境の作成: プロジェクト作成時に自動作成されます（POST /api/projects）
 */
function createDeprecatedResponse() {
  return NextResponse.json(
    {
      error: 'このエンドポイントは廃止されました。環境はプロジェクトに1対1で紐付けられます。',
      deprecated: true,
      alternatives: {
        'GET /api/environments': 'GET /api/projects/[project_id]/environment',
        'POST /api/environments': '環境はプロジェクト作成時に自動作成されます（POST /api/projects）',
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
 * @deprecated GET /api/environments は廃止されました（410 Gone）。
 * GET /api/projects/[project_id]/environment を使用してください。
 */
export async function GET(_request: NextRequest) {
  return createDeprecatedResponse();
}

/**
 * @deprecated POST /api/environments は廃止されました（410 Gone）。
 * 環境はプロジェクト作成時に自動作成されます（POST /api/projects）。
 */
export async function POST(_request: NextRequest) {
  return createDeprecatedResponse();
}
