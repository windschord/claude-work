import { test, expect } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';

test.describe('ハイブリッド設計機能', () => {
  let repoPath: string;

  // 各テストの前にログイン
  test.beforeEach(async ({ page }) => {
    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  // 各テスト後のクリーンアップ
  test.afterEach(async () => {
    if (repoPath) {
      await cleanupTestGitRepo(repoPath);
    }
  });

  test('プロジェクト登録フォームに保存場所選択が表示される', async ({ page }) => {
    // プロジェクト追加ボタンをクリック
    await page.click('text=プロジェクト追加');

    // リモートタブに切り替え
    await page.click('button:has-text("リモート")');

    // 保存場所選択のラジオボタンが表示される
    await expect(page.locator('text=保存場所')).toBeVisible();
    await expect(page.locator('input[type="radio"][value="docker"]')).toBeVisible();
    await expect(page.locator('input[type="radio"][value="host"]')).toBeVisible();
  });

  test('Docker環境がデフォルトで選択されている', async ({ page }) => {
    await page.click('text=プロジェクト追加');
    await page.click('button:has-text("リモート")');

    // Docker環境のラジオボタンがチェックされている
    const dockerRadio = page.locator('input[type="radio"][value="docker"]');
    await expect(dockerRadio).toBeChecked();
  });

  test('保存場所のツールチップが表示される', async ({ page }) => {
    await page.click('text=プロジェクト追加');
    await page.click('button:has-text("リモート")');

    // ヘルプアイコンにホバー
    const helpIcon = page.locator('svg').filter({ has: page.locator('title') }).first();
    await helpIcon.hover();

    // ツールチップが表示される（Docker環境の説明）
    await expect(page.locator('text=Docker環境（推奨）')).toBeVisible({ timeout: 2000 });
  });

  test('Host環境を選択できる', async ({ page }) => {
    await page.click('text=プロジェクト追加');
    await page.click('button:has-text("リモート")');

    // Host環境のラジオボタンをクリック
    await page.click('input[type="radio"][value="host"]');

    // Host環境がチェックされる
    const hostRadio = page.locator('input[type="radio"][value="host"]');
    await expect(hostRadio).toBeChecked();
  });

  test('設定画面が表示される', async ({ page }) => {
    // 設定ページに移動
    await page.goto('/settings');

    // 設定ページのタイトルが表示される
    await expect(page.locator('h1')).toContainText('設定');

    // Git Cloneタイムアウト設定が表示される
    await expect(page.locator('text=Git Clone タイムアウト')).toBeVisible();
    await expect(page.locator('input#timeout')).toBeVisible();

    // デバッグモード設定が表示される
    await expect(page.locator('text=デバッグモード')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();
  });

  test('設定を変更して保存できる', async ({ page }) => {
    await page.goto('/settings');

    // タイムアウト値を変更
    await page.fill('input#timeout', '10');

    // デバッグモードを有効化
    await page.click('input[type="checkbox"]');

    // 保存ボタンをクリック
    await page.click('button:has-text("保存")');

    // 成功メッセージが表示される
    await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 3000 });

    // ページをリロードして設定が保持されているか確認
    await page.reload();
    await expect(page.locator('input#timeout')).toHaveValue('10');
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('プロジェクト一覧に環境バッジが表示される', async ({ page }) => {
    repoPath = await createTestGitRepo();

    // ローカルプロジェクトを追加（Host環境）
    await page.click('text=プロジェクト追加');
    await page.fill('input#project-path', repoPath);
    await page.click('button:has-text("追加")');

    // プロジェクトカードが表示される
    await expect(page.locator('text=test-repo')).toBeVisible();

    // Host環境のバッジが表示される
    const hostBadge = page.locator('text=Host').first();
    await expect(hostBadge).toBeVisible();
  });

  test('無効なタイムアウト値は保存できない', async ({ page }) => {
    await page.goto('/settings');

    // 範囲外の値を入力
    await page.fill('input#timeout', '50');

    // 保存ボタンをクリック
    await page.click('button:has-text("保存")');

    // エラーメッセージが表示される
    await expect(page.locator('text=Timeout must be between')).toBeVisible({ timeout: 3000 });
  });

  // Note: Docker環境のcloneテストは実際のDockerが必要なため、
  // CI環境でのテスト実行を考慮してスキップまたは条件付き実行にする
  test.skip('Docker環境でプロジェクトをcloneできる', async ({ page }) => {
    // このテストはDocker環境が利用可能な場合のみ実行
    await page.click('text=プロジェクト追加');
    await page.click('button:has-text("リモート")');

    // Docker環境を選択（デフォルト）
    await page.fill('input#repo-url', 'https://github.com/octocat/Hello-World.git');

    // Cloneボタンをクリック
    await page.click('button:has-text("Clone")');

    // 成功メッセージが表示される
    await expect(page.locator('text=リポジトリをcloneしました')).toBeVisible({ timeout: 60000 });

    // プロジェクト一覧にDockerバッジが表示される
    await expect(page.locator('text=Docker')).toBeVisible();
  });
});
