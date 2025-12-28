import { test, expect } from '@playwright/test';

test.describe('ログイン機能', () => {
  test('ログインページが表示される', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('ClaudeWork');
    await expect(page.locator('h2')).toContainText('ログイン');
    await expect(page.locator('input#token')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('ログイン');
  });

  test('正しいトークンでログイン成功', async ({ page }) => {
    await page.goto('/login');

    // 環境変数からトークンを取得
    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';

    await page.fill('input#token', token);
    await page.click('button[type="submit"]');

    // ログイン成功後、ホームページにリダイレクトされる
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('プロジェクト一覧');
  });

  test('誤ったトークンでログイン失敗', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#token', 'invalid-token');
    await page.click('button[type="submit"]');

    // エラーメッセージが表示される
    await expect(page.locator('div.bg-red-100')).toBeVisible();

    // ログインページに留まる
    await expect(page).toHaveURL('/login');
  });

  test('トークンなしではログインボタンが無効', async ({ page }) => {
    await page.goto('/login');

    // トークンが空の場合、ログインボタンが無効
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });
});
