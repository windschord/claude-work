import { test, expect, Page } from '@playwright/test';

/**
 * テスト後のクリーンアップ: Hello-Worldプロジェクトを削除
 */
async function cleanupHelloWorldProjects(page: Page) {
  await page.goto('/projects');

  for (let i = 0; i < 3; i++) {
    const heading = page.locator('h3', { hasText: 'Hello-World' }).first();
    const isVisible = await heading.isVisible().catch(() => false);

    if (!isVisible) break;

    // ProjectCardコンポーネント内の削除ボタンを特定
    const card = page.locator('div').filter({ has: heading }).first();
    await card.getByRole('button', { name: '削除' }).click();

    // 確認ダイアログ
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: '削除' }).last().click();

    await page.waitForTimeout(1500);
  }
}

test.describe('リモートリポジトリクローン機能', () => {
  const TEST_REPO_URL = 'https://github.com/octocat/Hello-World.git';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
      await page.fill('input#token', token);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }

    // 既存のHello-Worldプロジェクトを削除
    await cleanupHelloWorldProjects(page);
  });

  test('リモートリポジトリをDockerでクローン', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'プロジェクト追加' }).click();

    // モーダル内の「リモート」タブ（Headless UI Tab）を取得
    const dialog = page.locator('[role="dialog"]');
    const remoteTab = dialog.locator('button', { hasText: 'リモート' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.waitFor({ state: 'visible' });
    await urlInput.fill(TEST_REPO_URL);

    const dockerRadio = page.locator('input[value="docker"]');
    await expect(dockerRadio).toBeChecked();

    const cloneButton = page.getByRole('button', { name: 'Clone' });
    await cloneButton.click();

    // 成功toast待機
    await expect(page.locator('[role="status"]').filter({ hasText: 'clone' })).toBeVisible({ timeout: 30000 });

    // プロジェクト追加確認
    await expect(page.getByRole('heading', { name: 'Hello-World' })).toBeVisible({ timeout: 5000 });

    // リモートバッジ確認
    await expect(page.locator('span', { hasText: 'リモート' }).first()).toBeVisible();

    // クリーンアップ
    await cleanupHelloWorldProjects(page);
  });

  test('リモートプロジェクトを更新', async ({ page }) => {
    // 前提: プロジェクト作成
    await page.goto('/projects');
    await page.getByRole('button', { name: 'プロジェクト追加' }).click();

    // モーダル内の「リモート」タブ（Headless UI Tab）を取得
    const dialog = page.locator('[role="dialog"]');
    const remoteTab = dialog.locator('button', { hasText: 'リモート' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);

    const cloneButton = page.getByRole('button', { name: 'Clone' });
    await cloneButton.click();

    await expect(page.locator('[role="status"]').filter({ hasText: 'clone' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Hello-World' })).toBeVisible({ timeout: 5000 });

    // プロジェクト更新
    await page.goto('/projects');

    const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Hello-World' }) }).first();
    const refreshButton = card.getByRole('button', { name: /リモートから更新|更新/ });
    await refreshButton.click();

    // スピナー確認
    await expect(card.locator('.animate-spin')).toBeVisible({ timeout: 3000 });

    // 成功通知
    await expect(page.locator('[role="status"]').filter({ hasText: /更新/ })).toBeVisible({ timeout: 15000 });

    // クリーンアップ
    await cleanupHelloWorldProjects(page);
  });

  test('Docker環境でセッション作成（ブランチ選択）', async ({ page }) => {
    // 前提: プロジェクト作成
    await page.goto('/projects');
    await page.getByRole('button', { name: 'プロジェクト追加' }).click();

    // モーダル内の「リモート」タブ（Headless UI Tab）を取得
    const dialog = page.locator('[role="dialog"]');
    const remoteTab = dialog.locator('button', { hasText: 'リモート' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);

    const cloneButton = page.getByRole('button', { name: 'Clone' });
    await cloneButton.click();

    await expect(page.locator('[role="status"]').filter({ hasText: 'clone' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Hello-World' })).toBeVisible({ timeout: 5000 });

    // セッション作成モーダルを開く
    await page.goto('/projects');

    const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Hello-World' }) }).first();
    await card.getByRole('button', { name: '新規セッション' }).click();

    // モーダル表示待機
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

    // Docker環境がデフォルト選択されていることを確認
    const dockerRadio = page.locator('input[type="radio"]').first();
    await expect(dockerRadio).toBeChecked();

    // ブランチ選択が表示される
    const branchSelect = page.locator('select[name="branch"]');
    await expect(branchSelect).toBeVisible();

    // デフォルトブランチ確認
    const selectedOption = branchSelect.locator('option:checked');
    await expect(selectedOption).toContainText(/master|main/);

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();

    // クリーンアップ
    await cleanupHelloWorldProjects(page);
  });

  test('無効なURLでエラー表示', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'プロジェクト追加' }).click();

    // モーダル内の「リモート」タブ（Headless UI Tab）を取得
    const dialog = page.locator('[role="dialog"]');
    const remoteTab = dialog.locator('button', { hasText: 'リモート' });
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.waitFor({ state: 'visible' });
    await urlInput.fill('invalid-url');

    const cloneButton = page.getByRole('button', { name: 'Clone' });
    await cloneButton.click();

    // エラー通知を確認
    await expect(
      page.locator('[role="status"]').filter({ hasText: /無効|失敗|error/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
