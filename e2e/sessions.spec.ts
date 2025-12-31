import { test, expect } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';
import path from 'path';

test.describe('セッション機能', () => {
  let repoPath: string;
  let repoName: string;
  let projectId: string;

  // 各テストの前にログインしてプロジェクトを追加
  test.beforeEach(async ({ page }) => {
    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // テスト用リポジトリを作成
    repoPath = await createTestGitRepo();
    repoName = path.basename(repoPath);

    // プロジェクトを追加
    await page.click('text=プロジェクト追加');
    await page.fill('input#project-path', repoPath);
    // モーダル内のsubmitボタンを明示的に指定
    await page.click('button[type="submit"]:has-text("追加")');
    // プロジェクトカードの見出しが表示されることを確認（動的なリポジトリ名に対応）
    await expect(page.getByRole('heading', { name: repoName, exact: true })).toBeVisible();

    // プロジェクトをクリックして詳細ページに移動
    await page.click('button:has-text("開く")');
    await expect(page).toHaveURL(/\/projects\/.+/);

    // URLからプロジェクトIDを取得
    const url = page.url();
    projectId = url.split('/projects/')[1];
  });

  test.afterEach(async () => {
    await cleanupTestGitRepo(repoPath);
  });

  test('セッション一覧ページが表示される', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('セッション管理');
    await expect(page.locator('h2')).toContainText('セッション一覧');
  });

  test('セッションを作成できる', async ({ page }) => {
    // セッション作成フォームが表示される
    await expect(page.locator('input#session-name')).toBeVisible();

    // セッション名を入力
    await page.fill('input#session-name', 'テストセッション');

    // 初期プロンプトを入力
    await page.fill('textarea#session-prompt', 'テスト用の初期プロンプト');

    // 作成ボタンをクリック
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });
    // セッションデータがロードされるまで待機
    await expect(page.locator('h1')).toContainText('テストセッション', { timeout: 10000 });
  });

  test('Claudeターミナルタブが表示される', async ({ page }) => {
    // セッションを作成
    await page.fill('input#session-name', 'ターミナルテスト');
    await page.fill('textarea#session-prompt', 'こんにちは');
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });

    // セッションデータがロードされるまで待機
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Claudeタブが選択されている
    await expect(page.locator('button:has-text("Claude")')).toHaveClass(/border-blue-500/);

    // ターミナルエリアが表示される（aria-labelで確認）
    await expect(page.locator('[aria-label="Claude Code Terminal"]')).toBeVisible({ timeout: 10000 });

    // 接続状態が表示される
    await expect(page.locator('text=Connected').or(page.locator('text=Disconnected'))).toBeVisible({ timeout: 10000 });

    // 再起動ボタンが表示される
    await expect(page.locator('button:has-text("Restart")')).toBeVisible();
  });

  test('セッションを停止できる', async ({ page }) => {
    // セッションを作成
    await page.fill('input#session-name', '停止テスト');
    await page.fill('textarea#session-prompt', '停止テスト');
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });

    // セッションデータがロードされるまで待機
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // セッションが実行中になるまで待機
    const stopButton = page.locator('button:has-text("停止")');
    await expect(stopButton).toBeVisible({ timeout: 15000 });

    await stopButton.click();
    await expect(page.locator('text=停止しました')).toBeVisible({ timeout: 10000 });
  });

  test('セッション一覧からセッション詳細へ遷移できる (BUG-004)', async ({ page }) => {
    // 最初のセッションを作成
    await page.fill('input#session-name', '遷移テスト1');
    await page.fill('textarea#session-prompt', '遷移テスト');
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移することを確認
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });
    const firstSessionUrl = page.url();
    const firstSessionId = firstSessionUrl.split('/sessions/')[1];

    // プロジェクト詳細ページに戻る
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(`/projects/${projectId}`);

    // 2つ目のセッションを作成
    await page.fill('input#session-name', '遷移テスト2');
    await page.fill('textarea#session-prompt', '遷移テスト2');
    await page.click('button:has-text("セッション作成")');
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });

    // 再びプロジェクト詳細ページに戻る
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(`/projects/${projectId}`);

    // セッション一覧が表示されることを確認
    await expect(page.locator('text=遷移テスト1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=遷移テスト2')).toBeVisible({ timeout: 10000 });

    // 最初のセッションカードをクリック
    const firstSessionCard = page.locator('[data-testid="session-card"]').filter({ hasText: '遷移テスト1' });
    await expect(firstSessionCard).toBeVisible();

    // カードがクリック可能であることを確認（cursor-pointerクラスが設定されている）
    await expect(firstSessionCard).toHaveClass(/cursor-pointer/);

    // セッションカードをクリック
    await firstSessionCard.click();

    // セッション詳細ページに遷移することを確認
    await expect(page).toHaveURL(`/sessions/${firstSessionId}`, { timeout: 10000 });
    // セッションデータがロードされるまで待機
    await expect(page.locator('h1')).toContainText('遷移テスト1', { timeout: 10000 });
  });
});
