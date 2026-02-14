import { test, expect, Page } from '@playwright/test';

/**
 * API経由で特定のPATを削除するヘルパー
 */
async function deletePATViaAPI(page: Page, patId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.request.delete(`/api/github-pat/${patId}`);
      return;
    } catch {
      if (attempt < 2) await page.waitForTimeout(1000);
    }
  }
  console.warn(`Failed to delete PAT ${patId} after 3 attempts`);
}

/**
 * API経由でテスト用PATを作成するヘルパー
 */
async function createTestPATViaAPI(page: Page, name: string): Promise<string> {
  const response = await page.request.post('/api/github-pat', {
    data: {
      name,
      token: 'ghp_FAKE_testCloneToken1234567890abcdef12345678',
      description: 'E2Eクローンテスト用',
    },
  });
  const data = await response.json();
  return data.id;
}

/**
 * API経由でPATを無効化するヘルパー
 */
async function togglePATViaAPI(page: Page, patId: string): Promise<void> {
  await page.request.post(`/api/github-pat/${patId}/toggle`);
}

test.describe('プロジェクト登録フォームでのPAT選択', () => {
  // テストごとに作成したPATのIDを追跡して個別に削除する
  const createdPATIds: string[] = [];

  test.afterEach(async ({ page }) => {
    // このテストで作成したPATのみを削除
    for (const id of createdPATIds) {
      await deletePATViaAPI(page, id);
    }
    createdPATIds.length = 0;
  });

  test('リモートタブでHTTPS URLを入力するとPAT選択が表示される（Docker環境）', async ({ page }) => {
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await expect(page.getByRole('heading', { name: 'プロジェクトを追加' })).toBeVisible();

    // リモートタブに切り替え
    await page.click('button[role="tab"]:has-text("リモート")');

    // リポジトリURL入力フィールドが表示される
    await expect(page.locator('#repo-url')).toBeVisible();

    // Docker環境がデフォルトで選択されていることを確認
    const dockerRadio = page.locator('input[name="cloneLocation"][value="docker"]');
    await expect(dockerRadio).toBeChecked();

    // SSH URLの場合、PAT選択は表示されない
    await page.fill('#repo-url', 'git@github.com:user/repo.git');
    await expect(page.locator('#github-pat')).not.toBeVisible();

    // HTTPS URLに変更すると、PAT選択が表示される
    await page.fill('#repo-url', 'https://github.com/user/repo.git');
    await expect(page.locator('#github-pat')).toBeVisible();
  });

  test('ホスト環境ではHTTPS URLでもPAT選択が表示されない', async ({ page }) => {
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await page.click('button[role="tab"]:has-text("リモート")');

    // HTTPS URLを入力
    await page.fill('#repo-url', 'https://github.com/user/repo.git');

    // Docker環境のときはPAT選択が表示される
    await expect(page.locator('#github-pat')).toBeVisible();

    // ホスト環境に切り替え
    await page.click('input[name="cloneLocation"][value="host"]');

    // PAT選択が非表示になる
    await expect(page.locator('#github-pat')).not.toBeVisible();
  });

  test('PAT選択のデフォルトは「PATを使用しない」', async ({ page }) => {
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await page.click('button[role="tab"]:has-text("リモート")');

    // HTTPS URLを入力（Docker環境はデフォルト）
    await page.fill('#repo-url', 'https://github.com/user/repo.git');

    // PAT選択のデフォルト値が空（PATを使用しない）であることを確認
    const patSelect = page.locator('#github-pat');
    await expect(patSelect).toBeVisible();
    await expect(patSelect).toHaveValue('');
  });

  test('作成したPATがプロジェクト登録フォームのセレクトに表示される', async ({ page }) => {
    // API経由でテスト用PATを作成
    const patId = await createTestPATViaAPI(page, 'Clone Test PAT');
    createdPATIds.push(patId);

    // プロジェクト一覧に移動
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await page.click('button[role="tab"]:has-text("リモート")');

    // HTTPS URLを入力
    await page.fill('#repo-url', 'https://github.com/user/repo.git');

    // PAT選択が表示される
    const patSelect = page.locator('#github-pat');
    await expect(patSelect).toBeVisible();

    // 作成したPATがオプションに含まれることを確認
    const option = patSelect.locator(`option:has-text("Clone Test PAT")`);
    await expect(option).toBeAttached();

    // PATを選択できる
    await patSelect.selectOption(patId);
    await expect(patSelect).toHaveValue(patId);
  });

  test('PAT設定画面へのリンクが表示される', async ({ page }) => {
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await page.click('button[role="tab"]:has-text("リモート")');

    // HTTPS URLを入力
    await page.fill('#repo-url', 'https://github.com/user/repo.git');

    // 「新しいPATを追加」リンクが表示される
    const patLink = page.locator('a:has-text("新しいPATを追加")');
    await expect(patLink).toBeVisible();
    await expect(patLink).toHaveAttribute('href', '/settings/github-pat');
  });

  test('無効化されたPATはセレクトに表示されない', async ({ page }) => {
    // API経由でテスト用PATを作成して無効化
    const patId = await createTestPATViaAPI(page, 'Disabled PAT');
    createdPATIds.push(patId);
    await togglePATViaAPI(page, patId);

    // プロジェクト一覧に移動
    await page.goto('/');

    // プロジェクト追加モーダルを開く
    await page.click('button:has-text("プロジェクト追加")');
    await page.click('button[role="tab"]:has-text("リモート")');

    // HTTPS URLを入力
    await page.fill('#repo-url', 'https://github.com/user/repo.git');

    // PAT選択が表示される
    const patSelect = page.locator('#github-pat');
    await expect(patSelect).toBeVisible();

    // 無効化されたPATはオプションに含まれないことを確認
    const option = patSelect.locator(`option:has-text("Disabled PAT")`);
    await expect(option).not.toBeAttached();
  });
});
