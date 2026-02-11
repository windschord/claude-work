import { test, expect, Page } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';
import path from 'path';

/**
 * 複数ブラウザE2Eテスト
 *
 * TASK-005: 複数ブラウザで同一のターミナル内容を表示することを検証
 * - US-001: 複数ブラウザでの同時接続サポート
 * - REQ-001-002: 複数接続の受け入れ
 * - REQ-001-003: ブロードキャスト配信
 */

test.describe('複数ブラウザでの同時接続', () => {
  let repoPath: string;
  let repoName: string;
  let sessionId: string;

  // テスト用のセットアップヘルパー
  async function loginAndCreateProject(page: Page): Promise<string> {
    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // プロジェクトを追加
    await page.click('text=プロジェクト追加');
    await page.fill('input#project-path', repoPath);
    await page.click('button[type="submit"]:has-text("追加")');
    await expect(page.getByRole('heading', { name: repoName, exact: true })).toBeVisible();

    // プロジェクトを開く
    await page.click('button:has-text("開く")');
    await expect(page).toHaveURL(/\/projects\/.+/);

    // プロジェクトIDを取得
    const url = page.url();
    return url.split('/projects/')[1];
  }

  async function createSession(page: Page, sessionName: string): Promise<string> {
    // セッション作成
    await page.fill('input#session-name', sessionName);
    await page.fill('textarea#session-prompt', 'Multi-browser test');
    await page.click('button:has-text("セッション作成")');

    // セッション詳細ページに遷移
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // セッションIDを取得
    const url = page.url();
    return url.split('/sessions/')[1];
  }

  async function waitForTerminal(page: Page) {
    // ターミナルエリアが表示されるまで待機
    await expect(page.locator('[aria-label="Claude Code Terminal"]')).toBeVisible({ timeout: 10000 });
    // 接続状態が表示されるまで待機
    await expect(page.locator('text=Connected').or(page.locator('text=Disconnected'))).toBeVisible({ timeout: 10000 });
  }

  test.beforeEach(async () => {
    // テスト用リポジトリを作成
    repoPath = await createTestGitRepo();
    repoName = path.basename(repoPath);
  });

  test.afterEach(async () => {
    await cleanupTestGitRepo(repoPath);
  });

  test('複数ブラウザから同じセッションに接続できる', async ({ browser }) => {
    // ブラウザ1: セッションを作成
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await loginAndCreateProject(page1);
    sessionId = await createSession(page1, 'マルチブラウザテスト');
    await waitForTerminal(page1);

    // ブラウザ2: 同じセッションに接続
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page2.goto('/login');
    await page2.fill('input#token', token);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/');

    // 同じセッションに直接アクセス
    await page2.goto(`/sessions/${sessionId}`);
    await expect(page2.locator('h1')).toBeVisible({ timeout: 10000 });
    await waitForTerminal(page2);

    // 両方のブラウザでターミナルが表示されている
    await expect(page1.locator('[aria-label="Claude Code Terminal"]')).toBeVisible();
    await expect(page2.locator('[aria-label="Claude Code Terminal"]')).toBeVisible();

    await context1.close();
    await context2.close();
  });

  test('ブラウザ1の入力がブラウザ2に表示される', async ({ browser }) => {
    // ブラウザ1: セッションを作成
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await loginAndCreateProject(page1);
    sessionId = await createSession(page1, '入力同期テスト');
    await waitForTerminal(page1);

    // ブラウザ2: 同じセッションに接続
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page2.goto('/login');
    await page2.fill('input#token', token);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/');
    await page2.goto(`/sessions/${sessionId}`);
    await waitForTerminal(page2);

    // Shellタブに切り替え（ターミナルでのコマンド実行）
    await page1.click('button:has-text("Shell")');
    await expect(page1.locator('[aria-label="Shell Terminal"]')).toBeVisible({ timeout: 5000 });

    await page2.click('button:has-text("Shell")');
    await expect(page2.locator('[aria-label="Shell Terminal"]')).toBeVisible({ timeout: 5000 });

    // ブラウザ1でコマンド入力（ターミナルにフォーカスしてから入力）
    const terminal1 = page1.locator('[aria-label="Shell Terminal"]');
    await terminal1.click();

    // echoコマンドを送信
    await page1.keyboard.type('echo "MULTI_BROWSER_TEST_OUTPUT"');
    await page1.keyboard.press('Enter');

    // 少し待機してから両方のターミナルの内容を確認
    await page1.waitForTimeout(2000);

    // 両方のブラウザで同じ出力が表示されることを確認
    // ターミナルの出力はXTermのDOMに表示されるため、テキストコンテンツで確認
    const terminal1Text = await terminal1.textContent();
    const terminal2Text = await page2.locator('[aria-label="Shell Terminal"]').textContent();

    // 両方のターミナルに入力したコマンドが含まれていることを確認
    expect(terminal1Text).toContain('echo');
    expect(terminal2Text).toContain('echo');

    await context1.close();
    await context2.close();
  });

  test('ブラウザ1を閉じてもブラウザ2は継続動作する', async ({ browser }) => {
    // ブラウザ1: セッションを作成
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await loginAndCreateProject(page1);
    sessionId = await createSession(page1, '接続独立性テスト');
    await waitForTerminal(page1);

    // ブラウザ2: 同じセッションに接続
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page2.goto('/login');
    await page2.fill('input#token', token);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/');
    await page2.goto(`/sessions/${sessionId}`);
    await waitForTerminal(page2);

    // ブラウザ1を閉じる
    await context1.close();

    // 少し待機
    await page2.waitForTimeout(1000);

    // ブラウザ2はまだ動作している
    await expect(page2.locator('h1')).toBeVisible();
    await expect(page2.locator('[aria-label="Claude Code Terminal"]')).toBeVisible();

    // Shellタブに切り替えられる（操作可能）
    await page2.click('button:has-text("Shell")');
    await expect(page2.locator('[aria-label="Shell Terminal"]')).toBeVisible({ timeout: 5000 });

    await context2.close();
  });

  test('再接続後もターミナル内容が表示される（スクロールバックバッファ）', async ({ browser }) => {
    // ブラウザ1: セッションを作成してコマンド実行
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await loginAndCreateProject(page1);
    sessionId = await createSession(page1, 'スクロールバックテスト');
    await waitForTerminal(page1);

    // Claudeタブで何か出力がある状態にする
    await expect(page1.locator('[aria-label="Claude Code Terminal"]')).toBeVisible({ timeout: 10000 });

    // ターミナルに何か出力があることを確認
    const terminal1 = page1.locator('[aria-label="Claude Code Terminal"]');
    await page1.waitForTimeout(2000);
    const terminal1Text = await terminal1.textContent();

    // 初期プロンプトが表示されているはず
    expect(terminal1Text).toBeTruthy();

    // ブラウザ1を閉じる
    await context1.close();

    // 少し待機（スクロールバックバッファの保存を待つ）
    await page1.context().browser()!.close();

    // ブラウザ2: 新しいコンテキストで再接続
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page2.goto('/login');
    await page2.fill('input#token', token);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/');
    await page2.goto(`/sessions/${sessionId}`);
    await waitForTerminal(page2);

    // 再接続後もターミナル内容が表示される
    const terminal2 = page2.locator('[aria-label="Claude Code Terminal"]');
    await page2.waitForTimeout(1000);
    const terminal2Text = await terminal2.textContent();

    // スクロールバックバッファが送信され、内容が表示されている
    expect(terminal2Text).toBeTruthy();
    expect(terminal2Text!.length).toBeGreaterThan(0);

    await context2.close();
  });
});
