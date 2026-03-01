# API設計: POST /api/environments/check-ports

## 概要

指定されたポート番号のHOST側使用状況をチェックするAPIエンドポイント。

**ファイル**: `src/app/api/environments/check-ports/route.ts`

## エンドポイント

### POST /api/environments/check-ports

**リクエスト**:
```typescript
interface CheckPortsRequest {
  ports: number[];                    // チェック対象のホストポート番号
  excludeEnvironmentId?: string;      // 除外する環境ID（編集中の自環境）
}
```

**レスポンス**:
```typescript
// 200 OK
interface CheckPortsResponse {
  results: PortCheckResult[];
}

// PortCheckResult
interface PortCheckResult {
  port: number;
  status: 'available' | 'in_use' | 'unknown';
  usedBy?: string;
  source?: 'os' | 'claudework';
}
```

**エラーレスポンス**:
```typescript
// 400 Bad Request
{ error: string }  // バリデーションエラー

// 500 Internal Server Error
{ error: string }  // サーバーエラー
```

## バリデーション

| チェック項目 | 条件 | エラーメッセージ |
|-------------|------|----------------|
| ports必須 | ports が配列でない、または空 | "ports must be a non-empty array" |
| ポート数上限 | ports.length > 20 | "Maximum 20 ports can be checked at once" |
| ポート範囲 | 各ポート 1-65535の整数 | "Invalid port number: {port}" |
| excludeEnvironmentId | 文字列であること（任意） | "excludeEnvironmentId must be a string" |

## 処理フロー

```text
1. リクエストボディのバリデーション
2. PortChecker.checkPorts() 呼び出し
3. 結果をJSON形式で返却
```

## 実装例

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ports, excludeEnvironmentId } = body;

    // バリデーション
    if (excludeEnvironmentId !== undefined && typeof excludeEnvironmentId !== 'string') {
      return NextResponse.json(
        { error: 'excludeEnvironmentId must be a string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(ports) || ports.length === 0) {
      return NextResponse.json(
        { error: 'ports must be a non-empty array' },
        { status: 400 }
      );
    }

    if (ports.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 ports can be checked at once' },
        { status: 400 }
      );
    }

    for (const port of ports) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json(
          { error: `Invalid port number: ${port}` },
          { status: 400 }
        );
      }
    }

    const checker = new PortChecker();
    const results = await checker.checkPorts({ ports, excludeEnvironmentId });

    return NextResponse.json({ results });
  } catch (error) {
    logger.error('Port check failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```
