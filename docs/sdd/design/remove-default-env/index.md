# デフォルト環境概念の廃止 - 技術設計書

## 概要

ExecutionEnvironmentの`is_default`フィールドを廃止し、環境選択を必須化する。

## 変更対象ファイル一覧

### バックエンド

| ファイル | 変更内容 |
|---------|---------|
| `src/db/schema.ts` | `is_default`カラム削除 |
| `src/services/environment-service.ts` | `getDefault()`, `ensureDefaultExists()`, `ensureDefaultEnvironment()`, デフォルト定数の削除。`create()`から`is_default: false`削除。`delete()`にセッション使用中チェック追加 |
| `server.ts` | `ensureDefaultExists()`呼び出し削除 |
| `src/app/api/projects/[project_id]/sessions/route.ts` | デフォルト環境フォールバック削除、environment_id必須バリデーション追加 |

### フロントエンド

| ファイル | 変更内容 |
|---------|---------|
| `src/hooks/useEnvironments.ts` | `Environment`インターフェースから`is_default`削除 |
| `src/components/environments/EnvironmentCard.tsx` | 「デフォルト」バッジ削除、削除ボタンのis_default無効化削除 |
| `src/components/projects/AddProjectModal.tsx` | `defaultEnvironmentId`ロジック削除、環境未選択時の送信無効化 |
| `src/components/projects/RemoteRepoForm.tsx` | `defaultEnvironmentId`ロジック削除、環境未選択時の送信無効化 |
| `src/components/projects/AddProjectWizard/StepEnvironment.tsx` | `is_default`依存の自動選択を廃止（1件時自動選択は維持）、`(default)`表示削除 |
| `src/components/sessions/CreateSessionModal.tsx` | is_defaultソートロジック削除 |

### テスト

| ファイル | 変更内容 |
|---------|---------|
| `src/services/__tests__/environment-service.test.ts` | デフォルト関連テスト削除、使用中チェックテスト追加 |
| `src/components/projects/__tests__/AddProjectModal.test.tsx` | モックから`is_default`削除 |
| `src/components/projects/__tests__/RemoteRepoForm.test.tsx` | モックから`is_default`削除 |
| `src/components/projects/__tests__/ProjectCard.test.tsx` | モックから`is_default`削除 |
| `src/components/projects/AddProjectWizard/__tests__/WizardContainer.test.tsx` | モックから`is_default`削除 |

## 設計詳細

### 1. DBスキーマ変更

```typescript
// Before
is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),

// After: 行削除
```

`npm run db:push`でスキーマを反映。SQLiteではカラム削除時にテーブルが再作成される。

> **データ移行安全性について:**
> - Drizzle ORMの`db:push`はカラム削除時にALTER TABLEまたはデータ移行を自動処理するため、既存データは保持される
> - 本番環境では事前にDBバックアップを強く推奨する（`cp data/claudework.db data/claudework.db.bak`）
> - 既存のデフォルト環境レコードは通常の環境として残る（`is_default`カラムが削除されるだけで、レコード自体は削除されない）

### 2. environment-service.ts 変更

**削除するもの:**
- `DEFAULT_HOST_ENVIRONMENT` 定数
- `DEFAULT_DOCKER_ENVIRONMENT` 定数
- `getDefault()` メソッド
- `ensureDefaultExists()` メソッド
- `ensureDefaultEnvironment()` メソッド
- `create()`内の`is_default: false`

**変更するもの:**
- `delete()`: トランザクション内でセッション参照チェックとDB削除をアトミックに実行

```typescript
async delete(id: string): Promise<void> {
  const environment = await this.findById(id);
  if (!environment) {
    throw new Error('環境が見つかりません');
  }

  // トランザクション内で使用中チェックとDBレコード削除をアトミックに実行
  // TOCTOU競合を防ぐため、チェックと削除を同一トランザクションでラップする
  db.transaction((tx) => {
    // 使用中のプロジェクトを確認（既存ロジック）
    const projectsWithEnv = tx.select(...)...;
    if (projectsWithEnv.length > 0) {
      throw new EnvironmentInUseError(`...`);
    }

    // 使用中のアクティブセッションを確認（終了済みセッションは無視）
    const sessionsWithEnv = tx.select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(and(
        eq(schema.sessions.environment_id, id),
        // アクティブなセッションステータス: running（実行中）, initializing（初期化中）, waiting_input（入力待ち）
        // completed, error, stopped は終了済みとして扱い、削除をブロックしない
        inArray(schema.sessions.status, ['running', 'initializing', 'waiting_input'])
      ))
      .all();
    if (sessionsWithEnv.length > 0) {
      // トランザクション内でのthrowはSQLiteにより自動的にロールバックされる
      throw new EnvironmentInUseError(
        `この環境は ${sessionsWithEnv.length} 件のアクティブなセッションで使用中のため削除できません`
      );
    }

    // DBレコードを先に削除（外部リソース削除はベストエフォートで後続実施）
    tx.delete(schema.executionEnvironments)
      .where(eq(schema.executionEnvironments.id, id))
      .run();
  });

  // 外部リソース（認証ディレクトリ、Docker Volume等）をベストエフォートで削除
}
```

### 3. セッション作成API変更

```typescript
// Before: フォールバックロジック
if (!effectiveEnvironmentId) {
  const defaultEnv = await environmentService.getDefault();
  // ...
}

// After: 必須バリデーション
if (!effectiveEnvironmentId) {
  return NextResponse.json(
    { error: 'プロジェクトに実行環境が設定されていません。プロジェクト設定で環境を選択してください。' },
    { status: 400 }
  );
}
```

> **`docker_mode`後方互換性について:**
> - `docker_mode`パラメータは以前のPRで非推奨化済みであり、フロントエンドからは既に送信されていない
> - 本変更で`docker_mode`のフォールバックロジックを完全に削除する
> - `environment_id`がプロジェクトに設定されていない場合は400エラーを返す（フォールバックなし）
> - 移行期間は不要（`docker_mode`は既にフロントエンドから送信されておらず、実質的に未使用）

### 4. UI変更方針

- プロジェクト作成フォーム: 環境未選択状態を初期状態とし、選択必須バリデーションを追加
- 環境カード: 「デフォルト」バッジとis_defaultによる削除制限を削除
- StepEnvironment:
  - 環境が1件のみの場合: 自動的にその環境を選択する
  - 環境が2件以上の場合: ユーザーがドロップダウンから明示的に選択する
  - 環境が0件の場合: 「利用可能な環境がありません」メッセージと環境設定ページへのリンクを表示する
