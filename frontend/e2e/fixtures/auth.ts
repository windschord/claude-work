import { Page } from '@playwright/test';

/**
 * 認証用ヘルパー関数
 */

const TEST_TOKEN = process.env.AUTH_TOKEN || 'test-token-for-e2e';

/**
 * ログインを実行する
 */
export async function login(page: Page, token: string = TEST_TOKEN) {
  await page.goto('/login');
  await page.fill('#token', token);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/**
 * 認証済み状態でページを開く
 */
export async function loginAndNavigate(page: Page, path: string = '/') {
  await login(page);
  if (path !== '/') {
    await page.goto(path);
  }
}
