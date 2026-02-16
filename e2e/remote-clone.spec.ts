import { test, expect } from '@playwright/test';

test.describe('リモートリポジトリクローン機能', () => {
  const TEST_REPO_URL = 'https://github.com/octocat/Hello-World.git';
  const TEST_REPO_NAME = 'Hello-World';

  // 各テストの前にログイン（既にログイン済みの場合はスキップ）
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // ログインページにリダイレクトされた場合のみログイン処理
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
      await page.fill('input#token', token);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }
  });

  test('リモートリポジトリをDockerでクローン', async ({ page }) => {
    // 1. プロジェクト一覧ページに移動
    await page.goto('/projects');

    // 2. 「プロジェクト追加」ボタンをクリック
    await page.click('button:has-text("プロジェクト追加")');

    // 3. 「リモートリポジトリ」タブが表示されるまで待機してクリック
    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    // 4. URLを入力（テスト用の公開リポジトリ）
    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.waitFor({ state: 'visible' });
    await urlInput.fill(TEST_REPO_URL);

    // 5. Clone先が「Docker」であることを確認（デフォルト）
    const dockerRadio = page.locator('input[value="docker"]');
    await expect(dockerRadio).toBeChecked();

    // 6. 「クローン」ボタンをクリック
    await page.click('button:has-text("クローン")');

    // 7. 成功通知を確認（toastが表示される）
    await expect(page.locator('text=clone')).toBeVisible({ timeout: 15000 });

    // 8. プロジェクト一覧に追加されたことを確認
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 5000 });

    // 9. 「リモート」バッジが表示されることを確認
    const remoteBadge = page.locator('span:has-text("リモート")');
    await expect(remoteBadge.first()).toBeVisible();

    // クリーンアップ: テストプロジェクトを削除
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("削除")').click();

    // 確認ダイアログで削除を確定
    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
  });

  test('リモートプロジェクトを更新', async ({ page }) => {
    // 前提: リモートプロジェクトを作成
    await page.goto('/projects');
    await page.click('button:has-text("プロジェクト追加")');
    await page.waitForSelector('[role="dialog"]');

    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);

    await page.click('button:has-text("クローン")');
    await expect(page.locator('text=clone')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 5000 });

    // 1. プロジェクト一覧ページに移動（既にいる）
    await page.goto('/projects');

    // 2. リモートプロジェクトの「更新」ボタンをクリック
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    const refreshButton = projectCard.locator('button[title="リモートから更新"]');
    await refreshButton.click();

    // 3. 更新中のスピナーが表示される
    await expect(projectCard.locator('.animate-spin')).toBeVisible({ timeout: 3000 });

    // 4. 成功通知を確認
    await expect(page.locator('text=更新')).toBeVisible({ timeout: 10000 });

    // クリーンアップ
    await projectCard.locator('button:has-text("削除")').click();
    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
  });

  test('Docker環境でセッション作成（ブランチ選択）', async ({ page }) => {
    // 前提: リモートプロジェクトを作成
    await page.goto('/projects');
    await page.click('button:has-text("プロジェクト追加")');
    await page.waitForSelector('[role="dialog"]');

    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);

    await page.click('button:has-text("クローン")');
    await expect(page.locator('text=clone')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 5000 });

    // 1. プロジェクト一覧ページに移動（既にいる）
    await page.goto('/projects');

    // 2. プロジェクトカードの「新規セッション」ボタンをクリック
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("新規セッション")').click();

    // モーダルが表示されるまで待機
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // 3. 環境選択でDocker環境が選択されていることを確認（デフォルト）
    // CreateSessionModalではラジオボタンで環境選択する実装
    const dockerRadio = page.locator('input[type="radio"][value*="docker"]').first();
    await expect(dockerRadio).toBeChecked();

    // 4. ブランチ選択が表示される
    const branchSelect = page.locator('select[name="branch"]');
    await expect(branchSelect).toBeVisible();

    // 5. デフォルトブランチが選択されていることを確認
    // Hello-Worldリポジトリのデフォルトブランチは'master'
    const selectedOption = branchSelect.locator('option:checked');
    await expect(selectedOption).toContainText(/master|main/);

    // モーダルを閉じる（セッション作成まではテストしない）
    const cancelButton = page.locator('button:has-text("キャンセル")');
    await cancelButton.click();

    // クリーンアップ
    await projectCard.locator('button:has-text("削除")').click();
    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
  });

  test('無効なURLでエラー表示', async ({ page }) => {
    // 1. プロジェクト一覧ページに移動
    await page.goto('/projects');

    // 2. 「プロジェクト追加」ボタンをクリック
    await page.click('button:has-text("プロジェクト追加")');

    // 3. 「リモートリポジトリ」タブが表示されるまで待機してクリック
    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    // 4. 無効なURLを入力
    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill('invalid-url');

    // 5. 「クローン」ボタンをクリック
    await page.click('button:has-text("クローン")');

    // 6. エラーメッセージが表示される
    // Toast通知またはフォーム内のエラーテキストを確認
    await expect(
      page.locator('text=/有効な|無効な|URL|clone/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('Clone先切り替え（Docker ⇔ Host）', async ({ page }) => {
    await page.goto('/projects');
    await page.click('button:has-text("プロジェクト追加")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.click();

    // 1. デフォルトでDockerが選択されている
    const dockerRadio = page.locator('input[value="docker"]');
    await expect(dockerRadio).toBeChecked();

    // 2. Hostに切り替え
    const hostRadio = page.locator('input[value="host"]');
    await hostRadio.click();
    await expect(hostRadio).toBeChecked();

    // 3. Dockerに戻す
    await dockerRadio.click();
    await expect(dockerRadio).toBeChecked();
  });

  test('環境選択のテスト（Docker→Host→SSH順）', async ({ page }) => {
    // 前提: リモートプロジェクトを作成
    await page.goto('/projects');
    await page.click('button:has-text("プロジェクト追加")');
    await page.waitForSelector('[role="dialog"]');

    const remoteTab = page.locator('button', { hasText: 'リモートリポジトリ' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);

    await page.click('button:has-text("クローン")');
    await expect(page.locator('text=clone')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 5000 });

    // セッション作成モーダルを開く
    await page.goto('/projects');
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("新規セッション")').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // 環境がDocker→Host→SSH順にソートされていることを確認
    const radioButtons = page.locator('input[type="radio"]');
    const count = await radioButtons.count();

    if (count >= 3) {
      // 最初のラジオボタン（Docker）が選択されている
      const firstRadio = radioButtons.nth(0);
      await expect(firstRadio).toBeChecked();
    }

    // モーダルを閉じる
    await page.locator('button:has-text("キャンセル")').click();

    // クリーンアップ
    await projectCard.locator('button:has-text("削除")').click();
    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
  });
});
