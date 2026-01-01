import { test, expect } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/setup';
import path from 'path';

test.describe('Debug Console Errors', () => {
  let repoPath: string;
  let repoName: string;
  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];

  test('capture console logs on session page', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}]: ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', err => {
      pageErrors.push(`${err.message}\n${err.stack}`);
    });

    const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
    await page.goto('/login');
    await page.fill('input#token', token);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Create test repo
    repoPath = await createTestGitRepo();
    repoName = path.basename(repoPath);

    // Add project
    await page.click('text=プロジェクト追加');
    await page.fill('input#project-path', repoPath);
    await page.click('button[type="submit"]:has-text("追加")');
    await expect(page.getByRole('heading', { name: repoName, exact: true })).toBeVisible();

    // Open project
    await page.click('button:has-text("開く")');
    await expect(page).toHaveURL(/\/projects\/.+/);

    // Create session
    await page.fill('input#session-name', 'debug-test');
    await page.fill('textarea#session-prompt', 'hello');
    await page.click('button:has-text("セッション作成")');

    // Wait for navigation to session page
    await expect(page).toHaveURL(/\/sessions\/.+/, { timeout: 10000 });

    // Wait to capture any errors
    await page.waitForTimeout(5000);

    // Output collected logs
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    console.log('\n=== Page Errors ===');
    pageErrors.forEach(err => console.log(err));

    // Get page content
    const content = await page.content();
    if (content.includes('Application error')) {
      console.log('\n=== Page Content (error detected) ===');
      console.log(content.substring(0, 3000));
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-session.png' });

    // Cleanup
    await cleanupTestGitRepo(repoPath);

    // Fail if errors detected
    if (pageErrors.length > 0) {
      throw new Error('Page errors detected: ' + pageErrors.join('\n'));
    }

    // Check page loaded correctly
    await expect(page.locator('h1')).toContainText('debug-test', { timeout: 5000 });
  });
});
