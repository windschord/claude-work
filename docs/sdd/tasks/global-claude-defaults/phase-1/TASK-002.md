# TASK-002: /api/settings/config API拡張

## 概要

既存の設定APIにclaude_defaults設定のGET/PUTサポートを追加する。

## 依存: TASK-001

## 対象ファイル

- `src/app/api/settings/config/route.ts` - 変更
- `src/app/api/settings/config/__tests__/route.test.ts` - 変更

## TDD手順

### 1. テスト作成

```typescript
describe('claude_defaults', () => {
  it('GET should include claude_defaults in response', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.config.claude_defaults).toBeDefined();
    expect(data.config.claude_defaults.dangerouslySkipPermissions).toBe(false);
    expect(data.config.claude_defaults.worktree).toBe(true);
  });

  it('PUT should update claude_defaults', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        claude_defaults: {
          dangerouslySkipPermissions: true,
          worktree: false,
        },
      }),
    });
    const response = await PUT(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.config.claude_defaults.dangerouslySkipPermissions).toBe(true);
    expect(data.config.claude_defaults.worktree).toBe(false);
  });

  it('PUT should reject invalid claude_defaults types', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        claude_defaults: {
          dangerouslySkipPermissions: 'invalid',
        },
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('PUT should reject unknown keys in claude_defaults', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        claude_defaults: {
          unknownKey: true,
        },
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });
});
```

### 2. 実装

- PUT handlerにclaude_defaultsのバリデーションを追加
- dangerouslySkipPermissions: boolean型チェック
- worktree: boolean型チェック
- 未知キーの拒否
- ConfigService.save()にclaude_defaultsを渡す

## 受入条件

- [ ] GET /api/settings/config がclaude_defaultsを含むレスポンスを返す
- [ ] PUT /api/settings/config でclaude_defaultsを更新できる
- [ ] 不正な型のリクエストが400エラーを返す
- [ ] 未知キーが含まれる場合に400エラーを返す
- [ ] テストが全て通過する
