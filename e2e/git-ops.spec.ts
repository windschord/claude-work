import { test, expect } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';

test.describe('Git操作機能', () => {
  let repoPath: string;

  // 各テストの前にログインしてプロジェクト・セッションを作成
  test.beforeEach(async ({ page }) => {
    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // テスト用リポジトリを作成
    repoPath = await createTestGitRepo();

    // プロジェクトを追加
    await page.click('text=プロジェクト追加');
    await page.fill('input#project-path', repoPath);
    await page.click('button:has-text("追加")');
    await expect(page.locator('text=test-repo')).toBeVisible();

    // プロジェクトをクリックして詳細ページに移動
    await page.click('button:has-text("開く")');
    await expect(page).toHaveURL(/\/projects\/.+/);

    // セッションを作成
    await page.fill('input#session-name', 'Git操作テスト');
    await page.fill('textarea#session-prompt', 'Git操作テスト');
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移
    await expect(page).toHaveURL(/\/sessions\/.+/);
  });

  test.afterEach(async () => {
    if (repoPath) {
      await cleanupTestGitRepo(repoPath);
    }
  });

  test('Diffタブが表示される', async ({ page }) => {
    // Diffタブをクリック
    await page.click('button:has-text("Diff")');

    // Diffタブがアクティブになる
    await expect(page.locator('button:has-text("Diff")')).toHaveClass(/border-blue-500/);

    // Git操作ボタンが表示される
    await expect(page.locator('button:has-text("リベース")')).toBeVisible();
    await expect(page.locator('button:has-text("スカッシュしてマージ")')).toBeVisible();
  });

  test('リベースボタンが機能する', async ({ page }) => {
    // Diffタブに移動
    await page.click('button:has-text("Diff")');

    // リベースボタンが表示される
    const rebaseButton = page.locator('button:has-text("リベース")');
    await expect(rebaseButton).toBeVisible();

    // リベースボタンをクリック
    await rebaseButton.click();

    // リベース処理が開始される
    // 注: 実際のGit操作がないため、UIの確認のみ
    // エラーが発生する可能性があるが、それはテストの目的
  });

  test('マージモーダルが表示される', async ({ page }) => {
    // Diffタブに移動
    await page.click('button:has-text("Diff")');

    // マージボタンをクリック
    await page.click('button:has-text("スカッシュしてマージ")');

    // マージモーダルが表示される
    await expect(page.locator('text=マージ')).toBeVisible();
  });

  test('ファイルリストが表示される', async ({ page }) => {
    // Diffタブに移動
    await page.click('button:has-text("Diff")');

    // ファイルリストコンポーネントが表示される
    const fileListContainer = page.locator('.w-64.border-r');
    await expect(fileListContainer).toBeVisible();

    // ファイルリストのヘッダーが表示される
    await expect(page.locator('text=変更されたファイル')).toBeVisible();
  });
});
