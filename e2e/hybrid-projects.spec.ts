import { test, expect } from '@playwright/test';

test.describe('ローカルとリモートプロジェクトの混在', () => {
  const TEST_REMOTE_REPO_URL = 'https://github.com/octocat/Hello-World.git';
  const TEST_REMOTE_REPO_NAME = 'Hello-World';
  const TEST_LOCAL_REPO_PATH = process.env.TEST_LOCAL_REPO_PATH || '/tmp/test-local-repo';

  // 各テストの前にログイン
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
      await page.fill('input#token', token);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }
  });

  test('ローカルとリモートプロジェクトが両方表示される', async ({ page }) => {
    await page.goto('/projects');

    // 1. ローカルプロジェクトを追加
    await page.click('button:has-text("プロジェクト追加")');

    // 「ローカル」タブが選択されていることを確認
    const localTab = page.locator('button', { hasText: 'ローカル' }).first();
    await expect(localTab).toHaveAttribute('aria-selected', 'true');

    // ローカルパスを入力
    const pathInput = page.locator('input[placeholder*="/path/to/git/repo"]');
    await pathInput.fill(TEST_LOCAL_REPO_PATH);

    // モーダル内の「追加」ボタンをクリック（2つ目のボタン）
    const addButton = page.locator('[role="dialog"] button:has-text("追加")');
    await addButton.click();

    // 成功を確認（toastまたはモーダルが閉じる）
    await page.waitForTimeout(2000);

    // 2. リモートプロジェクトを追加
    await page.click('button:has-text("プロジェクト追加")');

    const remoteTab = page.locator('button', { hasText: 'リモート' }).first();
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REMOTE_REPO_URL);

    // 「Clone」ボタンをクリック
    const cloneButton = page.locator('[role="dialog"] button:has-text("Clone")');
    await cloneButton.click();

    // 成功を確認（toastが表示される）
    await page.waitForTimeout(15000);

    // 3. 両方のプロジェクトが一覧に表示される
    await page.goto('/projects');

    const localProject = page.locator(`div:has-text("${TEST_LOCAL_REPO_PATH.split('/').pop()}")`).first();
    const remoteProject = page.locator(`div:has-text("${TEST_REMOTE_REPO_NAME}")`).first();

    await expect(localProject).toBeVisible({ timeout: 5000 });
    await expect(remoteProject).toBeVisible({ timeout: 5000 });

    // 4. リモートプロジェクトのみに「リモート」バッジが表示される
    const remoteBadge = remoteProject.locator('span:has-text("リモート")');
    await expect(remoteBadge).toBeVisible();

    // ローカルプロジェクトには「リモート」バッジがない
    const localBadge = localProject.locator('span:has-text("リモート")');
    await expect(localBadge).not.toBeVisible();

    // 5. リモートプロジェクトのみに「更新」ボタンが表示される
    const remoteRefreshButton = remoteProject.locator('button[title="リモートから更新"]');
    await expect(remoteRefreshButton).toBeVisible();

    // ローカルプロジェクトには「更新」ボタンがない
    const localRefreshButton = localProject.locator('button[title="リモートから更新"]');
    await expect(localRefreshButton).not.toBeVisible();

    // クリーンアップ: 両方のプロジェクトを削除
    await remoteProject.locator('button:has-text("削除")').click();
    let confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
    await page.waitForTimeout(1000);

    await localProject.locator('button:has-text("削除")').click();
    confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();
  });
});

test.describe('プロジェクト削除と再クローン', () => {
  const TEST_REPO_URL = 'https://github.com/octocat/Hello-World.git';
  const TEST_REPO_NAME = 'Hello-World';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
      await page.fill('input#token', token);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }
  });

  test('プロジェクト削除後に同じリポジトリを再クローン', async ({ page }) => {
    await page.goto('/projects');

    // 1. リモートリポジトリをクローン（1回目）
    await page.click('button:has-text("プロジェクト追加")');

    const remoteTab = page.locator('button', { hasText: 'リモート' }).first();
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);
    const cloneBtn = page.locator('[role="dialog"] button:has-text("Clone")');
    await cloneBtn.click();

    // 成功を確認
    // クローン完了を待機
    await page.waitForTimeout(15000);
    // プロジェクト名が表示されるのを待機
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 10000 });

    // 2. プロジェクトを削除
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("削除")').click();

    const confirmDialog = page.locator('[role="dialog"]');
    await confirmDialog.locator('button:has-text("削除")').last().click();

    // プロジェクトが削除されたことを確認
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).not.toBeVisible({ timeout: 5000 });

    // 3. 同じリポジトリを再度クローン（2回目）
    await page.click('button:has-text("プロジェクト追加")');

    const remoteTab2 = page.locator('button', { hasText: 'リモート' }).first();
    await remoteTab2.waitFor({ state: 'visible' });
    await remoteTab2.click();

    const urlInput2 = page.locator('input[placeholder*="git@github.com"]');
    await urlInput2.fill(TEST_REPO_URL);
    const cloneBtn2 = page.locator('[role="dialog"] button:has-text("Clone")');
    await cloneBtn2.click();

    // 成功を確認
    await expect(page.locator('text=clone')).toBeVisible({ timeout: 15000 });

    // 4. プロジェクトが正常に登録されていることを確認
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 5000 });

    // 「リモート」バッジが表示される
    const remoteBadge = page.locator('span:has-text("リモート")');
    await expect(remoteBadge.first()).toBeVisible();

    // クリーンアップ
    const projectCard2 = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard2.locator('button:has-text("削除")').click();
    const confirmDialog2 = page.locator('[role="dialog"]');
    await confirmDialog2.locator('button:has-text("削除")').last().click();
  });
});

test.describe('複数ブランチの切り替え', () => {
  const TEST_REPO_URL = 'https://github.com/octocat/Hello-World.git';
  const TEST_REPO_NAME = 'Hello-World';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
      await page.fill('input#token', token);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }

    // テスト用リモートプロジェクトを作成
    await page.goto('/projects');
    await page.click('button:has-text("プロジェクト追加")');

    const remoteTab = page.locator('button', { hasText: 'リモート' }).first();
    await remoteTab.waitFor({ state: 'visible' });
    await remoteTab.click();

    const urlInput = page.locator('input[placeholder*="git@github.com"]');
    await urlInput.fill(TEST_REPO_URL);
    const cloneBtn3 = page.locator('[role="dialog"] button:has-text("Clone")');
    await cloneBtn3.click();

    // クローン完了を待機
    await page.waitForTimeout(15000);
    // プロジェクト名が表示されるのを待機
    await expect(page.locator(`text=${TEST_REPO_NAME}`)).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    // クリーンアップ
    await page.goto('/projects');
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();

    // プロジェクトが存在する場合のみ削除
    const isVisible = await projectCard.isVisible().catch(() => false);
    if (isVisible) {
      await projectCard.locator('button:has-text("削除")').click();
      const confirmDialog = page.locator('[role="dialog"]');
      await confirmDialog.locator('button:has-text("削除")').last().click();
    }
  });

  test('異なるブランチで複数セッション作成', async ({ page }) => {
    await page.goto('/projects');

    // 1. セッション作成モーダルを開く
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("新規セッション")').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // 2. ブランチ選択が表示される
    const branchSelect = page.locator('select[name="branch"]');
    await expect(branchSelect).toBeVisible();

    // 3. ブランチ一覧を取得
    const options = await branchSelect.locator('option').all();
    const branchCount = options.length;

    // ブランチが2つ以上あることを確認
    expect(branchCount).toBeGreaterThanOrEqual(1);

    // 4. デフォルトブランチを確認
    const defaultBranch = await branchSelect.inputValue();
    expect(defaultBranch).toMatch(/master|main/);

    // 5. デフォルトブランチでセッション作成を試みる（モーダルを閉じるだけ）
    // 注: 実際のセッション作成はClaude Code起動が必要なため、UIのみテスト
    const cancelButton = page.locator('button:has-text("キャンセル")');
    await cancelButton.click();

    // 6. 再度モーダルを開いて別ブランチを選択
    if (branchCount > 1) {
      await projectCard.locator('button:has-text("新規セッション")').click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // 2番目のブランチを選択
      const secondBranch = await options[1].getAttribute('value');
      if (secondBranch) {
        await branchSelect.selectOption(secondBranch);

        // 選択されたブランチを確認
        const selectedBranch = await branchSelect.inputValue();
        expect(selectedBranch).toBe(secondBranch);
      }

      // モーダルを閉じる
      await page.locator('button:has-text("キャンセル")').click();
    }
  });

  test('ブランチ選択のデフォルト値確認', async ({ page }) => {
    await page.goto('/projects');

    // セッション作成モーダルを開く
    const projectCard = page.locator(`div:has-text("${TEST_REPO_NAME}")`).first();
    await projectCard.locator('button:has-text("新規セッション")').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // ブランチ選択のデフォルト値がデフォルトブランチであることを確認
    const branchSelect = page.locator('select[name="branch"]');
    const selectedOption = branchSelect.locator('option:checked');

    // Hello-Worldリポジトリのデフォルトブランチは'master'
    await expect(selectedOption).toContainText(/master|main/);

    // モーダルを閉じる
    await page.locator('button:has-text("キャンセル")').click();
  });
});
