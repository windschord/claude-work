# TASK-002: セッション作成API docker_volume_idバリデーション追加

## 対応

- Issue #208
- US-003/REQ-001, REQ-002
- 設計: `docs/sdd/design/docker-session-fixes/components/session-api.md`

## 説明

セッション作成APIに `clone_location=docker` かつ `docker_volume_id=null` のプロジェクトに対するバリデーションを追加する。

## 対象ファイル

- 実装: `src/app/api/projects/[project_id]/sessions/route.ts`
- テスト: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`

## 技術的文脈

- フレームワーク: Next.js 15 App Router
- テスト: Vitest
- DB: Drizzle ORM + SQLite

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | clone_location=docker + docker_volume_id=null で400エラー、エラーメッセージに原因と対処含む |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

`src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts` に以下のテストケースを追加:

```typescript
describe('POST - Docker volume validation', () => {
  it('clone_location=docker かつ docker_volume_id=null の場合 400エラーを返す', async () => {
    // プロジェクトを clone_location='docker', docker_volume_id=null で作成
    // POST /api/projects/{id}/sessions
    // 400ステータスを検証
    // エラーメッセージにボリューム未設定の旨が含まれることを検証
  });

  it('clone_location=docker かつ docker_volume_id が設定済みの場合は正常処理される', async () => {
    // プロジェクトを clone_location='docker', docker_volume_id='cw-repo-test' で作成
    // 正常にworktree作成処理に進むことを検証（他のエラーは許容）
  });

  it('clone_location=host の場合 docker_volume_id=null でもエラーにならない', async () => {
    // プロジェクトを clone_location='host', docker_volume_id=null で作成
    // バリデーションエラーにならないことを検証
  });
});
```

### 2. テスト実行 → 失敗確認

```bash
npx vitest run src/app/api/projects/\[project_id\]/sessions/__tests__/route.test.ts
```

### 3. テストコミット

### 4. 実装

`src/app/api/projects/[project_id]/sessions/route.ts` のPOSTハンドラ:

環境チェック（行224-244付近）の後に追加:

```typescript
// Docker環境プロジェクトのボリュームIDバリデーション
if (project.clone_location === 'docker' && !project.docker_volume_id) {
  return NextResponse.json(
    {
      error: 'Docker volume not configured',
      message: 'このプロジェクトはDocker環境(clone_location=docker)ですが、Dockerボリュームが設定されていません。プロジェクトを削除して再作成してください。',
    },
    { status: 400 },
  );
}
```

### 5. テスト通過確認 → 実装コミット

## 受入基準

- [ ] `clone_location=docker` / `docker_volume_id=null` → 400エラー
- [ ] `clone_location=docker` / `docker_volume_id` 設定済み → バリデーション通過
- [ ] `clone_location=host` / `docker_volume_id=null` → バリデーション通過
- [ ] エラーメッセージが具体的で対処方法を含む
- [ ] 既存テストがすべて通過
- [ ] 新規テストが通過

## 依存関係

なし

## 推定工数

25分

## ステータス

`TODO`
