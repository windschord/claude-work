import { test, expect } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';

test.describe('プロジェクト管理機能', () => {
  let repoPath: string;

  // 各テストの前にログイン
  test.beforeEach(async ({ page }) => {
    const token = process.env.AUTH_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('プロジェクト一覧ページが表示される', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('プロジェクト一覧');
    await expect(page.locator('button')).toContainText('プロジェクト追加');
  });

  test('プロジェクトを追加できる', async ({ page }) => {
    repoPath = await createTestGitRepo();

    // プロジェクト追加ボタンをクリック
    await page.click('text=プロジェクト追加');

    // モーダルが表示される
    await expect(page.locator('input[placeholder*="パス"]')).toBeVisible();

    // リポジトリパスを入力
    await page.fill('input[placeholder*="パス"]', repoPath);

    // 追加ボタンをクリック
    await page.click('button:has-text("追加")');

    // プロジェクトが一覧に表示される
    await expect(page.locator('text=test-repo')).toBeVisible();

    await cleanupTestGitRepo(repoPath);
  });

  test('プロジェクトを削除できる', async ({ page }) => {
    repoPath = await createTestGitRepo();

    // まずプロジェクトを追加
    await page.click('text=プロジェクト追加');
    await page.fill('input[placeholder*="パス"]', repoPath);
    await page.click('button:has-text("追加")');

    // プロジェクトが表示されるのを待つ
    await expect(page.locator('text=test-repo')).toBeVisible();

    // 削除ボタンをクリック（プロジェクトカードの削除ボタン）
    await page.click('button[aria-label="削除"]');

    // 確認ダイアログが表示される
    await expect(page.locator('text=削除しますか')).toBeVisible();

    // 削除確認
    await page.click('button:has-text("削除")');

    // プロジェクトが一覧から消える
    await expect(page.locator('text=test-repo')).not.toBeVisible();

    await cleanupTestGitRepo(repoPath);
  });

  test('プロジェクトをクリックすると詳細ページに遷移する', async ({ page }) => {
    repoPath = await createTestGitRepo();

    // プロジェクトを追加
    await page.click('text=プロジェクト追加');
    await page.fill('input[placeholder*="パス"]', repoPath);
    await page.click('button:has-text("追加")');

    // プロジェクトが表示されるのを待つ
    await expect(page.locator('text=test-repo')).toBeVisible();

    // プロジェクトカードをクリック
    await page.click('text=test-repo');

    // プロジェクト詳細ページに遷移
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.locator('h1')).toContainText('セッション管理');

    await cleanupTestGitRepo(repoPath);
  });
});
