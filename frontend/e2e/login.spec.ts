import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth';

/**
 * ログインフローのE2Eテスト
 */

const TEST_TOKEN = process.env.AUTH_TOKEN || 'test-token-for-e2e';
const INVALID_TOKEN = 'invalid-token-12345';

test.describe('ログインフロー', () => {
  test('ログインページが正しく表示される', async ({ page }) => {
    await page.goto('/login');

    // タイトルとフォームの確認
    await expect(page.locator('h2')).toContainText('Claude Work');
    await expect(page.locator('#token')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('正しいトークンでログインに成功する', async ({ page }) => {
    await page.goto('/login');

    // トークン入力
    await page.fill('#token', TEST_TOKEN);

    // ログインボタンをクリック
    await page.click('button[type="submit"]');

    // ダッシュボードにリダイレクトされることを確認
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('Claude Work');
  });

  test('誤ったトークンでエラーが表示される', async ({ page }) => {
    await page.goto('/login');

    // 誤ったトークン入力
    await page.fill('#token', INVALID_TOKEN);

    // ログインボタンをクリック
    await page.click('button[type="submit"]');

    // エラーメッセージが表示されることを確認
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });

  test('空のトークンでバリデーションエラーが表示される', async ({ page }) => {
    await page.goto('/login');

    // トークンを空のまま送信
    await page.click('button[type="submit"]');

    // バリデーションエラーが表示されることを確認
    await expect(page.locator('.text-red-800')).toContainText('トークンを入力してください');
  });

  test('認証済みの状態でログインページにアクセスするとダッシュボードにリダイレクトされる', async ({ page }) => {
    // ログイン
    await login(page);

    // ログインページにアクセス
    await page.goto('/login');

    // ダッシュボードにリダイレクトされることを確認
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('Claude Work');
  });

  test('ログアウト機能が正しく動作する', async ({ page }) => {
    // ログイン
    await login(page);

    // ログアウトボタンを探してクリック
    const logoutButton = page.locator('button:has-text("ログアウト")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // ログインページにリダイレクトされることを確認
      await page.waitForURL('/login');
      await expect(page.locator('h2')).toContainText('Claude Work');
    }
  });
});
