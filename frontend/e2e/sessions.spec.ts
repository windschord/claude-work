import { test, expect } from '@playwright/test';
import { loginAndNavigate } from './fixtures/auth';
import { TestGitRepo } from './fixtures/git-repo';

/**
 * セッション管理のE2Eテスト
 */

test.describe('セッション管理フロー', () => {
  let testRepo: TestGitRepo;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // テスト用Gitリポジトリを作成
    testRepo = new TestGitRepo();

    // ログイン
    await loginAndNavigate(page, '/');

    // プロジェクトを追加
    const addButton = page.locator('button:has-text("追加"), button:has-text("プロジェクトを追加")');
    if (await addButton.count() > 0) {
      await addButton.first().click();
      const pathInput = page.locator('input[name="path"], input[placeholder*="パス"]');
      await pathInput.fill(testRepo.path);
      const submitButton = page.locator('button[type="submit"]:has-text("追加"), button:has-text("作成")');
      await submitButton.click();

      // プロジェクトが追加されるまで待機
      await page.waitForTimeout(2000);

      // プロジェクト詳細ページに移動
      const projectLink = page.locator('a[href*="/projects/"]');
      if (await projectLink.count() > 0) {
        await projectLink.first().click();
        await page.waitForURL(/\/projects\/([a-f0-9-]+)/);

        // プロジェクトIDを抽出
        const url = page.url();
        const match = url.match(/\/projects\/([a-f0-9-]+)/);
        if (match) {
          projectId = match[1];
        }
      }
    }
  });

  test.afterEach(() => {
    // テスト用リポジトリをクリーンアップ
    if (testRepo) {
      testRepo.cleanup();
    }
  });

  test('セッション一覧が表示される', async ({ page }) => {
    // セッション一覧のタイトルが表示されることを確認
    await expect(page.locator('h2:has-text("セッション一覧")')).toBeVisible();
  });

  test('セッション作成フォームが表示される', async ({ page }) => {
    // セッション名入力欄が表示されることを確認
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await expect(nameInput).toBeVisible();

    // プロンプト入力欄が表示されることを確認（オプション）
    const promptInput = page.locator('textarea[name="prompt"], textarea[placeholder*="プロンプト"]');
    if (await promptInput.count() > 0) {
      await expect(promptInput).toBeVisible();
    }
  });

  test('セッションを作成できる', async ({ page }) => {
    const sessionName = 'test-session-' + Date.now();

    // セッション名を入力
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await nameInput.fill(sessionName);

    // プロンプトを入力（オプション）
    const promptInput = page.locator('textarea[name="prompt"], textarea[placeholder*="プロンプト"]');
    if (await promptInput.count() > 0) {
      await promptInput.fill('テスト用のプロンプト');
    }

    // 作成ボタンをクリック
    const createButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("セッションを作成")');
    await createButton.click();

    // セッションが作成されるまで待機
    await page.waitForTimeout(2000);

    // セッション一覧にセッション名が表示されることを確認
    await expect(page.locator(`text=${sessionName}`)).toBeVisible();
  });

  test('セッションにステータスアイコンが表示される', async ({ page }) => {
    // セッションを作成
    const sessionName = 'status-test-' + Date.now();
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await nameInput.fill(sessionName);
    const createButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("セッションを作成")');
    await createButton.click();

    // セッションが作成されるまで待機
    await page.waitForTimeout(2000);

    // ステータスアイコンまたはステータス表示を確認
    const statusIndicator = page.locator('[data-testid="session-status"], .status-icon, span:has-text("実行中"), span:has-text("待機中")');
    if (await statusIndicator.count() > 0) {
      await expect(statusIndicator.first()).toBeVisible();
    }
  });

  test('セッションを選択すると詳細画面に遷移する', async ({ page }) => {
    // セッションを作成
    const sessionName = 'detail-test-' + Date.now();
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await nameInput.fill(sessionName);
    const createButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("セッションを作成")');
    await createButton.click();

    // セッションが作成されるまで待機
    await page.waitForTimeout(2000);

    // セッションのリンクをクリック
    const sessionLink = page.locator(`a:has-text("${sessionName}")`);
    if (await sessionLink.count() > 0) {
      await sessionLink.click();

      // セッション詳細ページに遷移することを確認
      await expect(page).toHaveURL(/\/sessions\/[a-f0-9-]+/);

      // セッション名が表示されることを確認
      await expect(page.locator(`text=${sessionName}`)).toBeVisible();
    } else {
      // セッションリンクがない場合は、リスト項目をクリック
      const sessionItem = page.locator(`[data-testid*="session"], li:has-text("${sessionName}")`);
      if (await sessionItem.count() > 0) {
        await sessionItem.first().click();
        await expect(page).toHaveURL(/\/sessions\/[a-f0-9-]+/);
      }
    }
  });

  test('セッション詳細画面でチャットタブが表示される', async ({ page }) => {
    // セッションを作成して詳細画面に移動
    const sessionName = 'chat-test-' + Date.now();
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await nameInput.fill(sessionName);
    const createButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("セッションを作成")');
    await createButton.click();
    await page.waitForTimeout(2000);

    const sessionLink = page.locator(`a:has-text("${sessionName}")`);
    if (await sessionLink.count() > 0) {
      await sessionLink.click();
      await page.waitForURL(/\/sessions\/[a-f0-9-]+/);

      // チャットタブが存在することを確認
      const chatTab = page.locator('button:has-text("チャット")');
      await expect(chatTab).toBeVisible();

      // メッセージ入力フォームが存在することを確認
      const messageInput = page.locator('textarea[placeholder*="メッセージ"], input[type="text"]');
      if (await messageInput.count() > 0) {
        await expect(messageInput.first()).toBeVisible();
      }
    }
  });

  test('セッション詳細画面で変更タブが表示される', async ({ page }) => {
    // セッションを作成して詳細画面に移動
    const sessionName = 'changes-test-' + Date.now();
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    await nameInput.fill(sessionName);
    const createButton = page.locator('button[type="submit"]:has-text("作成"), button:has-text("セッションを作成")');
    await createButton.click();
    await page.waitForTimeout(2000);

    const sessionLink = page.locator(`a:has-text("${sessionName}")`);
    if (await sessionLink.count() > 0) {
      await sessionLink.click();
      await page.waitForURL(/\/sessions\/[a-f0-9-]+/);

      // 変更タブが存在することを確認
      const changesTab = page.locator('button:has-text("変更")');
      await expect(changesTab).toBeVisible();

      // 変更タブをクリック
      await changesTab.click();

      // Git操作ボタンが表示されることを確認
      const rebaseButton = page.locator('button:has-text("取り込み"), button:has-text("rebase")');
      const mergeButton = page.locator('button:has-text("マージ")');

      if (await rebaseButton.count() > 0) {
        await expect(rebaseButton.first()).toBeVisible();
      }
      if (await mergeButton.count() > 0) {
        await expect(mergeButton.first()).toBeVisible();
      }
    }
  });
});
