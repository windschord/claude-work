import { test, expect, Page } from '@playwright/test';

/**
 * API経由で全テスト用PATを削除するクリーンアップヘルパー
 */
async function cleanupAllTestPATs(page: Page) {
  const baseURL = 'http://localhost:3001';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.request.get(`${baseURL}/api/github-pat`);
      if (response.ok()) {
        const data = await response.json();
        for (const pat of data.pats || []) {
          await page.request.delete(`${baseURL}/api/github-pat/${pat.id}`);
        }
      }
      return;
    } catch {
      if (attempt < 2) await page.waitForTimeout(1000);
    }
  }
}

/**
 * PAT管理画面に遷移するヘルパー
 */
async function goToPATSettings(page: Page) {
  await page.goto('/settings/github-pat');
  await expect(page.locator('h1')).toContainText('GitHub PAT管理');
}

/**
 * テスト用PATを作成するヘルパー
 */
async function createPAT(page: Page, name: string, token: string, description?: string) {
  await page.click('button:has-text("PATを追加")');

  // フォームが表示されることを確認
  await expect(page.locator('#pat-name')).toBeVisible();

  await page.fill('#pat-name', name);
  await page.fill('#pat-token', token);
  if (description) {
    await page.fill('#pat-description', description);
  }

  await page.click('button[type="submit"]:has-text("作成")');

  // PAT一覧にテーブル行として表示されるのを待つ
  await expect(page.locator(`td:has-text("${name}")`)).toBeVisible({ timeout: 10000 });
}

test.describe('GitHub PAT管理機能', () => {
  // PAT CRUDテストはDB共有のためシリアル実行
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // テスト前に全PATを削除してクリーンな状態にする
    await cleanupAllTestPATs(page);
    await goToPATSettings(page);
  });

  test.afterEach(async ({ page }) => {
    // テスト後もクリーンアップ
    await cleanupAllTestPATs(page);
  });

  test('PAT管理画面が表示される', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('GitHub PAT管理');
    await expect(page.locator('button:has-text("PATを追加")')).toBeVisible();
  });

  test('PATが未登録の場合、空メッセージが表示される', async ({ page }) => {
    // 並列テストがPATを作成している可能性があるため、テスト直前に再度クリーンアップしてリロード
    await cleanupAllTestPATs(page);
    await page.reload();
    await expect(page.locator('h1')).toContainText('GitHub PAT管理');
    await expect(page.locator('text=PATが登録されていません')).toBeVisible();
  });

  test('PATを作成できる', async ({ page }) => {
    await createPAT(page, 'E2E Test PAT', 'ghp_e2eTestToken1234567890abcdef12345678', 'E2Eテスト用');

    // 一覧に表示されることを確認
    await expect(page.locator('td:has-text("E2E Test PAT")')).toBeVisible();
    await expect(page.locator('td:has-text("E2Eテスト用")')).toBeVisible();

    // ステータスが「有効」であることを確認
    const row = page.locator('tr', { has: page.locator('td:has-text("E2E Test PAT")') });
    await expect(row.locator('text=有効')).toBeVisible();
  });

  test('PATの追加フォームをキャンセルできる', async ({ page }) => {
    await page.click('button:has-text("PATを追加")');

    // フォームが表示される
    await expect(page.locator('#pat-name')).toBeVisible();

    // キャンセルボタンをクリック
    await page.click('button:has-text("キャンセル")');

    // フォームが非表示になる
    await expect(page.locator('#pat-name')).not.toBeVisible();
  });

  test('PATを編集できる', async ({ page }) => {
    // PATを作成
    await createPAT(page, 'Edit Test PAT', 'ghp_editTestToken1234567890abcdef12345678', '編集前');

    // 編集ボタンをクリック
    const editRow = page.locator('tr', { has: page.locator('td:has-text("Edit Test PAT")') });
    await editRow.locator('button:has-text("編集")').click();

    // インライン編集フォームが表示される（保存ボタンの出現で確認）
    const saveButton = page.getByRole('button', { name: '保存' });
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    // 名前を変更
    await nameInput.fill('Updated PAT');

    // 保存
    await saveButton.click();

    // 更新された名前が表示される
    await expect(page.locator('td:has-text("Updated PAT")')).toBeVisible({ timeout: 10000 });
    // 元の名前は表示されない
    await expect(page.locator('td:has-text("Edit Test PAT")')).not.toBeVisible();
  });

  test('PATの編集をキャンセルできる', async ({ page }) => {
    // PATを作成
    await createPAT(page, 'Cancel Edit PAT', 'ghp_cancelEditToken1234567890abcdef12345', '説明');

    const row = page.locator('tr', { has: page.locator('td:has-text("Cancel Edit PAT")') });

    // 編集開始
    await row.locator('button:has-text("編集")').click();
    const saveButton = page.getByRole('button', { name: '保存' });
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('Should Not Save');

    // キャンセル
    await page.getByRole('button', { name: 'キャンセル' }).click();

    // 元の名前がそのまま表示される
    await expect(page.locator('td:has-text("Cancel Edit PAT")')).toBeVisible();
    await expect(page.locator('td:has-text("Should Not Save")')).not.toBeVisible();
  });

  test('PATを削除できる', async ({ page }) => {
    // PATを作成
    await createPAT(page, 'Delete Test PAT', 'ghp_deleteTestToken1234567890abcdef12345', '削除テスト');

    // 一覧に表示されることを確認
    await expect(page.locator('td:has-text("Delete Test PAT")')).toBeVisible();

    // 削除ボタンをクリック
    const row = page.locator('tr', { has: page.locator('td:has-text("Delete Test PAT")') });
    await row.locator('button:has-text("削除")').click();

    // 一覧から消えることを確認
    await expect(page.locator('td:has-text("Delete Test PAT")')).not.toBeVisible();
  });

  test('PATの有効/無効を切り替えできる', async ({ page }) => {
    // PATを作成
    await createPAT(page, 'Toggle Test PAT', 'ghp_toggleTestToken1234567890abcdef12345', 'トグルテスト');

    const row = page.locator('tr', { has: page.locator('td:has-text("Toggle Test PAT")') });

    // 「無効化」ボタンをクリック
    await row.locator('button:has-text("無効化")').click();

    // 「有効化」ボタンが表示されるのを待つ（ステータスが切り替わった証拠）
    await expect(row.locator('button:has-text("有効化")')).toBeVisible({ timeout: 10000 });

    // 再度有効化
    await row.locator('button:has-text("有効化")').click();

    // 「無効化」ボタンが表示されるのを待つ
    await expect(row.locator('button:has-text("無効化")')).toBeVisible({ timeout: 10000 });
  });

  test('PAT作成、編集、削除のフルフローが正しく動作する', async ({ page }) => {
    // 1. PATを作成
    await createPAT(page, 'Full Flow PAT', 'ghp_fullFlowToken1234567890abcdef1234567', 'フルフローテスト');
    await expect(page.locator('td:has-text("Full Flow PAT")')).toBeVisible();

    // 2. 編集
    const editRow = page.locator('tr', { has: page.locator('td:has-text("Full Flow PAT")') });
    await editRow.locator('button:has-text("編集")').click();
    const saveBtn = page.getByRole('button', { name: '保存' });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });

    const nameInput = page.getByRole('textbox').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('Updated Full Flow PAT');
    await saveBtn.click();

    // 保存完了を待つ（編集モードが解除される）
    await expect(page.getByRole('button', { name: '編集' })).toBeVisible({ timeout: 15000 });
    // 更新された名前が表示される
    await expect(page.locator('td:has-text("Updated Full Flow PAT")')).toBeVisible({ timeout: 10000 });

    // 3. 無効化
    const updatedRow = page.locator('tr', { has: page.locator('td:has-text("Updated Full Flow PAT")') });
    await updatedRow.locator('button:has-text("無効化")').click();
    await expect(updatedRow.locator('button:has-text("有効化")')).toBeVisible({ timeout: 10000 });

    // 4. 削除
    await updatedRow.locator('button:has-text("削除")').click();
    await expect(page.locator('td:has-text("Updated Full Flow PAT")')).not.toBeVisible();
  });
});
