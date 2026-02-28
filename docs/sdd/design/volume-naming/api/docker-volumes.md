# API設計: Docker Volumes

## エンドポイント

### GET /api/docker/volumes

Docker Volume一覧を取得する。

### リクエスト

パラメータなし。

### レスポンス

#### 成功 (200)

```json
{
  "volumes": [
    {
      "name": "cw-repo-my-project",
      "driver": "local",
      "createdAt": "2026-01-15T10:30:00Z",
      "labels": {}
    },
    {
      "name": "claude-repo-abc123",
      "driver": "local",
      "createdAt": "2025-12-01T08:00:00Z",
      "labels": {}
    }
  ]
}
```

#### Docker未接続 (503)

```json
{
  "error": "Docker daemon is not available"
}
```

#### サーバーエラー (500)

```json
{
  "error": "Failed to list volumes"
}
```

### 実装

```typescript
// src/app/api/docker/volumes/route.ts
import { NextResponse } from 'next/server';
import { DockerClient } from '@/services/docker-client';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const client = DockerClient.getInstance();

    // Docker接続確認
    const isConnected = await client.ping();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Docker daemon is not available' },
        { status: 503 }
      );
    }

    const result = await client.listVolumes();
    const volumes = (result.Volumes || []).map(v => ({
      name: v.Name,
      driver: v.Driver,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
    }));

    return NextResponse.json({ volumes });
  } catch (error) {
    logger.error('Failed to list Docker volumes', { error });
    return NextResponse.json(
      { error: 'Failed to list volumes' },
      { status: 500 }
    );
  }
}
```

### テスト方針

- DockerClientのモックを使用
- Docker未接続時の503レスポンス
- 正常時のvolumes配列マッピング
- テストファイル: `src/app/api/docker/volumes/__tests__/route.test.ts`

## 関連要件

- REQ-002-002
