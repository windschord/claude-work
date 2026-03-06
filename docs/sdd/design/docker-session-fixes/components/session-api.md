# セッション作成APIバリデーション追加

## 対応要件

- US-003/REQ-001: `clone_location=docker` かつ `docker_volume_id=null` で400エラー
- US-003/REQ-002: 原因と対処方法のヒントを含むエラーメッセージ
- NFR-001: データ不整合の早期検出

## 現状のコード

```typescript
// src/app/api/projects/[project_id]/sessions/route.ts:217-252
// プロジェクト取得後、環境IDチェックはあるが
// docker_volume_idのバリデーションがない
const project = db.select().from(schema.projects)
  .where(eq(schema.projects.id, project_id)).get();
if (!project) {
  return NextResponse.json({ error: 'Project not found' }, { status: 404 });
}
// environment_idチェックのみ...
```

## 修正設計

プロジェクト取得後、環境チェックの後、worktree作成前にバリデーションを追加する。

### 追加するバリデーション

```typescript
// 環境チェック後、worktree作成前に追加
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

### 挿入位置

既存の環境チェック（行224-244付近）の後、セッション名処理（行254付近）の前に挿入する。

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/app/api/projects/[project_id]/sessions/route.ts` | バリデーション追加（約10行） |

## テスト方針

- `clone_location=docker` / `docker_volume_id=null` → 400エラー
- `clone_location=docker` / `docker_volume_id` 設定済み → 正常処理
- `clone_location=host` / `docker_volume_id=null` → 正常処理
- エラーレスポンスのメッセージ内容を検証
