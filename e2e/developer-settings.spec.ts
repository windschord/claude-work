import { test, expect, Page } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';

/**
 * API経由で全テスト用開発ツール設定を削除するクリーンアップヘルパー
 */
async function cleanupAllDeveloperSettings(page: Page) {
  try {
    // グローバル設定は削除せず、空に更新
    await page.request.put('/api/developer-settings/global', {
      data: {
        git_username: null,
        git_email: null,
      },
    });
  } catch {
    // グローバル設定が存在しない場合は無視
  }
}

/**
 * テスト用プロジェクトを作成
 */
async function createTestProject(page: Page, _name: string): Promise<{ id: string; path: string }> {
  // 実際のGitリポジトリを作成
  const testPath = await createTestGitRepo();

  const response = await page.request.post('/api/projects', {
    data: {
      path: testPath,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    await cleanupTestGitRepo(testPath);
    throw new Error(`Failed to create test project: ${response.status()} - ${text}`);
  }

  const data = await response.json();
  return { id: data.project?.id || data.id, path: testPath };
}

/**
 * テスト用プロジェクトを削除
 */
async function deleteTestProject(page: Page, projectId: string, repoPath?: string) {
  try {
    await page.request.delete(`/api/projects/${projectId}`);
  } catch {
    // プロジェクトが存在しない場合は無視
  }

  if (repoPath) {
    await cleanupTestGitRepo(repoPath);
  }
}

/**
 * 開発ツール設定ページに遷移するヘルパー
 */
async function goToDeveloperSettings(page: Page) {
  await page.goto('/settings/developer');
  await expect(page.locator('h1')).toContainText('開発ツール設定');
}

test.describe('開発ツール設定管理機能', () => {
  // 設定CRUDテストはDB共有のためシリアル実行
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // テスト前に設定をクリーンアップ
    await cleanupAllDeveloperSettings(page);
    await goToDeveloperSettings(page);
  });

  test.afterEach(async ({ page }) => {
    // テスト後もクリーンアップ
    await cleanupAllDeveloperSettings(page);
  });

  test('開発ツール設定画面が表示される', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('開発ツール設定');
    await expect(page.locator('button:has-text("グローバル設定")')).toBeVisible();
    await expect(page.locator('button:has-text("プロジェクト別設定")')).toBeVisible();
  });

  test.describe('グローバルGit設定', () => {
    test('グローバルGit設定を保存できる', async ({ page }) => {
      // グローバル設定タブがアクティブであることを確認
      await expect(page.locator('button:has-text("グローバル設定")')).toHaveAttribute('aria-selected', 'true');

      // Git設定フォームを入力
      await page.fill('#git-username', 'test-user');
      await page.fill('#git-email', 'test@example.com');

      // 保存ボタンをクリック
      await page.click('button[type="submit"]:has-text("保存")');

      // 成功メッセージが表示される
      await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // ページをリロードして設定が保存されていることを確認
      await page.reload();
      await expect(page.locator('#git-username')).toHaveValue('test-user');
      await expect(page.locator('#git-email')).toHaveValue('test@example.com');
    });

    test.skip('グローバルGit設定でメールアドレスのバリデーションエラーが表示される', async ({ page }) => {
      // グローバル設定タブがアクティブであることを確認
      await expect(page.locator('button:has-text("グローバル設定")')).toHaveAttribute('aria-selected', 'true');

      // 無効なメールアドレスを入力
      await page.fill('#git-username', 'test-user');
      await page.fill('#git-email', 'invalid-email');

      // 保存ボタンをクリック
      await page.click('button[type="submit"]:has-text("保存")');

      // エラーメッセージが表示される（クライアントサイドバリデーション）
      await expect(page.locator('p:has-text("有効なメールアドレスを入力してください")')).toBeVisible({ timeout: 10000 });
    });

    test('グローバルGit設定を更新できる', async ({ page }) => {
      // 初期設定を保存
      await page.fill('#git-username', 'initial-user');
      await page.fill('#git-email', 'initial@example.com');
      await page.click('button[type="submit"]:has-text("保存")');
      await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // 設定を更新
      await page.fill('#git-username', 'updated-user');
      await page.fill('#git-email', 'updated@example.com');
      await page.click('button[type="submit"]:has-text("保存")');
      await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // リロードして更新が反映されていることを確認
      await page.reload();
      await expect(page.locator('#git-username')).toHaveValue('updated-user');
      await expect(page.locator('#git-email')).toHaveValue('updated@example.com');
    });
  });

  test.describe('プロジェクト別Git設定', () => {
    let testProjectId: string;
    let testProjectPath: string;

    test.beforeEach(async ({ page }) => {
      // テスト用プロジェクトを作成
      const project = await createTestProject(page, `E2E Test Project ${Date.now()}`);
      testProjectId = project.id;
      testProjectPath = project.path;


      // グローバル設定を保存
      await page.request.put('/api/developer-settings/global', {
        data: {
          git_username: 'global-user',
          git_email: 'global@example.com',
        },
      });
    });

    test.afterEach(async ({ page }) => {
      // テスト用プロジェクトを削除
      if (testProjectId) {
        await deleteTestProject(page, testProjectId, testProjectPath);
      }
    });

    test('プロジェクト別Git設定を保存できる', async ({ page }) => {
      await goToDeveloperSettings(page);

      // プロジェクト別設定タブをクリック
      await page.click('button:has-text("プロジェクト別設定")');

      // プロジェクトを選択
      const projectSelect = page.locator('#project-select');
      await projectSelect.selectOption({ index: 1 }); // インデックス0は「-- プロジェクトを選択 --」

      // フォームが表示されるまで待つ
      await expect(page.locator('#git-username')).toBeVisible({ timeout: 10000 });

      // プロジェクト設定を入力
      await page.fill('#git-username', 'project-user');
      await page.fill('#git-email', 'project@example.com');

      // 保存ボタンをクリック
      await page.click('button[type="submit"]:has-text("保存")');

      // 成功メッセージが表示される
      await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // ページをリロードして設定が保存されていることを確認
      await page.reload();
      await page.click('button:has-text("プロジェクト別設定")');
      await projectSelect.selectOption({ index: 1 });
      await expect(page.locator('#git-username')).toHaveValue('project-user');
      await expect(page.locator('#git-email')).toHaveValue('project@example.com');
    });

    test.skip('プロジェクト別Git設定を削除できる', async ({ page }) => {

      // プロジェクト設定を作成
      const putResponse = await page.request.put(`/api/developer-settings/project/${testProjectId}`, {
        data: {
          git_username: 'project-user',
          git_email: 'project@example.com',
        },
      });

      if (!putResponse.ok()) {
        const error = await putResponse.text();
        throw new Error(`Failed to create project settings: ${putResponse.status()} - ${error}`);
      }

      await goToDeveloperSettings(page);

      // プロジェクト別設定タブをクリック
      await page.click('button:has-text("プロジェクト別設定")');

      // プロジェクトを選択
      const projectSelect = page.locator('#project-select');
      await projectSelect.selectOption({ index: 1 });

      // フォームが表示されるまで待つ
      await expect(page.locator('#git-username')).toBeVisible({ timeout: 10000 });

      // プロジェクト設定が読み込まれるまで待つ
      await expect(page.locator('#git-username')).toHaveValue('project-user', { timeout: 10000 });

      // 削除ボタンが表示されていることを確認してクリック
      const deleteButton = page.locator('button:has-text("設定を削除")');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // 成功メッセージが表示される（削除または保存成功のいずれか）
      await expect(page.locator('text=設定を削除しました, text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // フォームがグローバル設定の値にフォールバックすることを確認
      await page.waitForTimeout(500); // 状態更新を待つ
      await expect(page.locator('#git-username')).toHaveValue('global-user');
      await expect(page.locator('#git-email')).toHaveValue('global@example.com');
    });

    test('プロジェクト未選択時は設定フォームが表示されない', async ({ page }) => {
      await goToDeveloperSettings(page);

      // プロジェクト別設定タブをクリック
      await page.click('button:has-text("プロジェクト別設定")');

      // プロジェクトセレクトボックスのみ表示され、フォームは非表示
      await expect(page.locator('#project-select')).toBeVisible();

      // プロジェクトが未選択の場合、フォームは表示されない
      const gitUsernameInputs = page.locator('#git-username');
      const count = await gitUsernameInputs.count();
      expect(count).toBe(0);
    });
  });

  test.describe('SSH鍵管理', () => {
    test.skip('SSH鍵の登録テスト（未実装）', async () => {
      // Note: SSH鍵APIが実装された後にテストを追加
    });

    test.skip('SSH鍵の削除テスト（未実装）', async () => {
      // Note: SSH鍵APIが実装された後にテストを追加
    });
  });

  test('グローバル設定とプロジェクト設定のフルフロー', async ({ page }) => {
    // 1. グローバル設定を保存
    await page.fill('#git-username', 'global-flow-user');
    await page.fill('#git-email', 'global-flow@example.com');
    await page.click('button[type="submit"]:has-text("保存")');
    await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

    // 2. プロジェクトを作成
    const project = await createTestProject(page, `Flow Test Project ${Date.now()}`);
    const projectId = project.id;
    const projectPath = project.path;

    try {
      await page.reload();

      // 3. プロジェクト別設定タブに切り替え
      await page.click('button:has-text("プロジェクト別設定")');

      // 4. プロジェクトを選択
      await page.locator('#project-select').selectOption({ index: 1 });
      await expect(page.locator('#git-username')).toBeVisible({ timeout: 10000 });

      // 5. プロジェクト設定を保存
      await page.fill('#git-username', 'project-flow-user');
      await page.fill('#git-email', 'project-flow@example.com');
      await page.click('button[type="submit"]:has-text("保存")');
      await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 10000 });

      // 6. グローバル設定タブに戻り、グローバル設定が変更されていないことを確認
      await page.click('button:has-text("グローバル設定")');
      await expect(page.locator('#git-username')).toHaveValue('global-flow-user');
      await expect(page.locator('#git-email')).toHaveValue('global-flow@example.com');

      // 7. プロジェクト設定の確認（削除機能は未実装の可能性があるためスキップ）
      // Note: 削除機能のテストはTASK-010で実装予定
    } finally {
      // プロジェクトを削除
      await deleteTestProject(page, projectId, projectPath);
    }
  });
});
