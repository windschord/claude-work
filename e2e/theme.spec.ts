import { test, expect } from '@playwright/test';

test.describe('テーマ切り替え機能', () => {
  test.beforeEach(async ({ page }) => {
    // キャッシュをクリア
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // ログインページに移動
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('テーマ切り替えボタンが表示される', async ({ page }) => {
    const themeToggle = page.getByLabel('Toggle theme');
    await expect(themeToggle).toBeVisible();
  });

  test('テーマを切り替えるとHTMLクラスが変更される', async ({ page }) => {
    const themeToggle = page.getByLabel('Toggle theme');
    await themeToggle.waitFor({ state: 'visible', timeout: 5000 });

    // 初期状態のHTMLクラスを取得
    const initialClass = await page.evaluate(() => document.documentElement.className);

    // テーマ切り替えボタンをクリック
    await themeToggle.click();
    await page.waitForTimeout(500);

    // クリック後のHTMLクラスを取得
    const afterClickClass = await page.evaluate(() => document.documentElement.className);

    // HTMLクラスが変更されていることを確認
    expect(afterClickClass).not.toBe(initialClass);
  });

  test('テーマを切り替えるとローカルストレージが更新される', async ({ page }) => {
    const themeToggle = page.getByLabel('Toggle theme');
    await themeToggle.waitFor({ state: 'visible', timeout: 5000 });

    // 初期状態のローカルストレージを取得
    const initialTheme = await page.evaluate(() => localStorage.getItem('theme'));

    // テーマ切り替えボタンをクリック
    await themeToggle.click();
    await page.waitForTimeout(500);

    // クリック後のローカルストレージを取得
    const afterClickTheme = await page.evaluate(() => localStorage.getItem('theme'));

    // ローカルストレージが変更されていることを確認
    expect(afterClickTheme).not.toBe(initialTheme);
  });

  test('テーマを3回切り替えると毎回テーマが変わる', async ({ page }) => {
    const themeToggle = page.getByLabel('Toggle theme');
    await themeToggle.waitFor({ state: 'visible', timeout: 5000 });

    // 1回目クリック
    await themeToggle.click();
    await page.waitForTimeout(500);
    const theme1 = await page.evaluate(() => localStorage.getItem('theme'));

    // 2回目クリック
    await themeToggle.click();
    await page.waitForTimeout(500);
    const theme2 = await page.evaluate(() => localStorage.getItem('theme'));

    // 3回目クリック
    await themeToggle.click();
    await page.waitForTimeout(500);
    const theme3 = await page.evaluate(() => localStorage.getItem('theme'));

    // 各クリックでテーマが変わっていることを確認
    expect(theme1).not.toBe(theme2);
    expect(theme2).not.toBe(theme3);
  });
});
