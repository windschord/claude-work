# TASK-012: E2Eテストの作成

## 説明

- 対象ファイル: `e2e/remote-clone.spec.ts`（新規作成）
- リモートリポジトリクローン機能のE2Eテストを実装
- Playwrightを使用してブラウザ自動化テスト
- 主要なユーザーフローを網羅

## 技術的文脈

- テストフレームワーク: Playwright
- ブラウザ: Chromium（デフォルト）
- 参照すべき既存テスト: `e2e/*.spec.ts`

## 実装手順（TDD）

1. テスト作成: `e2e/remote-clone.spec.ts`
2. テスト実行: `npm run e2e`
3. テスト通過確認
4. コミット

## テストシナリオ

### シナリオ1: リモートリポジトリのクローン（Docker環境）

```typescript
test('リモートリポジトリをDockerでクローン', async ({ page }) => {
  // 1. プロジェクト一覧ページに移動
  await page.goto('/projects');

  // 2. 「プロジェクト追加」ボタンをクリック
  await page.click('button:has-text("プロジェクト追加")');

  // 3. 「リモートリポジトリ」タブをクリック
  await page.click('button:has-text("リモートリポジトリ")');

  // 4. URLを入力（テスト用の公開リポジトリ）
  await page.fill('input[placeholder*="git@github.com"]', 'https://github.com/user/test-repo.git');

  // 5. Clone先が「Docker」であることを確認（デフォルト）
  await expect(page.locator('input[value="docker"]')).toBeChecked();

  // 6. 「クローン」ボタンをクリック
  await page.click('button:has-text("クローン")');

  // 7. 成功通知を確認
  await expect(page.locator('text=プロジェクトを登録しました')).toBeVisible();

  // 8. プロジェクト一覧に追加されたことを確認
  await expect(page.locator('text=test-repo')).toBeVisible();

  // 9. 「リモート」バッジが表示されることを確認
  await expect(page.locator('text=リモート')).toBeVisible();
});
```

### シナリオ2: リモートプロジェクトの更新

```typescript
test('リモートプロジェクトを更新', async ({ page }) => {
  // 前提: リモートプロジェクトが登録済み

  // 1. プロジェクト一覧ページに移動
  await page.goto('/projects');

  // 2. リモートプロジェクトの「更新」ボタンをクリック
  await page.click('button:has-text("更新")');

  // 3. 更新中のスピナーが表示される
  await expect(page.locator('.animate-spin')).toBeVisible();

  // 4. 成功通知を確認
  await expect(page.locator('text=プロジェクトを更新しました')).toBeVisible();
});
```

### シナリオ3: Docker環境でのセッション作成（ブランチ選択）

```typescript
test('Docker環境でセッション作成（ブランチ選択）', async ({ page }) => {
  // 前提: リモートプロジェクトが登録済み

  // 1. プロジェクト一覧ページに移動
  await page.goto('/projects');

  // 2. プロジェクトカードの「セッション作成」ボタンをクリック
  await page.click('button:has-text("セッション作成")');

  // 3. 環境選択でDocker環境が選択されていることを確認（デフォルト）
  await expect(page.locator('select[name="environment"]')).toHaveValue(/docker/);

  // 4. ブランチ選択が表示される
  await expect(page.locator('select[name="branch"]')).toBeVisible();

  // 5. デフォルトブランチが選択されていることを確認
  await expect(page.locator('select[name="branch"] option:checked')).toContainText('main');

  // 6. 「作成」ボタンをクリック
  await page.click('button:has-text("作成")');

  // 7. セッションページに遷移
  await expect(page).toHaveURL(/\/sessions\/.+/);
});
```

### シナリオ4: エラー処理（無効なURL）

```typescript
test('無効なURLでエラー表示', async ({ page }) => {
  // 1. プロジェクト一覧ページに移動
  await page.goto('/projects');

  // 2. 「プロジェクト追加」ボタンをクリック
  await page.click('button:has-text("プロジェクト追加")');

  // 3. 「リモートリポジトリ」タブをクリック
  await page.click('button:has-text("リモートリポジトリ")');

  // 4. 無効なURLを入力
  await page.fill('input[placeholder*="git@github.com"]', 'invalid-url');

  // 5. 「クローン」ボタンをクリック
  await page.click('button:has-text("クローン")');

  // 6. エラーメッセージが表示される
  await expect(page.locator('text=有効なGitリポジトリURL')).toBeVisible();
});
```

## 受入基準

- [ ] `e2e/remote-clone.spec.ts`が存在する
- [ ] リモートクローンのE2Eテストが実装されている
- [ ] プロジェクト更新のE2Eテストが実装されている
- [ ] セッション作成（ブランチ選択）のE2Eテストが実装されている
- [ ] エラー処理のE2Eテストが実装されている
- [ ] `npm run e2e`で全テスト通過
- [ ] テストが4シナリオ以上ある

## 依存関係

- TASK-007〜011（Phase 3の全UI実装）

## 推定工数

40分

## ステータス

`DONE`

## 完了報告

### 実装内容

**ファイル**: `e2e/remote-clone.spec.ts` (178行)

**実装済みテストシナリオ**:
1. リモートリポジトリをDockerでクローン
2. リモートプロジェクトを更新
3. Docker環境でセッション作成（ブランチ選択）
4. 無効なURLでエラー表示

**受入基準チェック**:
- ✅ 全項目クリア

**コミット**:
- `8e008df`: "feat(e2e): リモートリポジトリクローン機能のE2Eテストを追加"

## 備考

- テスト用の公開リポジトリを使用（例: https://github.com/octocat/Hello-World.git ）
- テストは独立して実行可能にする（テストデータのクリーンアップ）
- Playwrightのベストプラクティスに従う
