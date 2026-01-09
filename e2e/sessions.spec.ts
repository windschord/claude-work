import { test, expect } from '@playwright/test';
import { TEST_CONFIG, generateSessionName } from './helpers/setup';

test.describe('Docker Session Management', () => {
  // Store created session IDs for cleanup
  const createdSessionIds: string[] = [];

  test.afterEach(async ({ request }) => {
    // Cleanup: Delete any created sessions
    for (const sessionId of createdSessionIds) {
      try {
        await request.delete(`/api/sessions/${sessionId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdSessionIds.length = 0;
  });

  test('should display the Docker session home page', async ({ page }) => {
    await page.goto('/docker');

    // Check page title (h2 visible in the sidebar)
    await expect(page.locator('h2:has-text("Docker Sessions")')).toBeVisible();

    // Check for create session button (Plus icon button)
    await expect(page.locator('button[title="Create new session"]')).toBeVisible();
  });

  test('should open session creation modal', async ({ page }) => {
    await page.goto('/docker');

    // Click create session button
    await page.click('button[title="Create new session"]');

    // Modal should be visible
    await expect(page.locator('text=Create New Session')).toBeVisible();

    // Form fields should be present
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="repoUrl"]')).toBeVisible();
    await expect(page.locator('input[name="branch"]')).toBeVisible();
  });

  test('should create a new session', async ({ page }) => {
    await page.goto('/docker');

    const sessionName = generateSessionName();

    // Click create session button
    await page.click('button[title="Create new session"]');

    // Fill in the form
    await page.fill('input[name="name"]', sessionName);
    await page.fill('input[name="repoUrl"]', TEST_CONFIG.testRepoUrl);
    await page.fill('input[name="branch"]', TEST_CONFIG.testBranch);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for modal to close and session to appear in list
    await expect(page.locator(`text=${sessionName}`)).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });

    // Store session ID for cleanup
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    const sessionId = await sessionCard.getAttribute('data-session-id');
    if (sessionId) {
      createdSessionIds.push(sessionId);
    }
  });

  test('should display session status', async ({ page, request }) => {
    // Create a session via API
    const sessionName = generateSessionName();
    const response = await request.post('/api/sessions', {
      data: {
        name: sessionName,
        repoUrl: TEST_CONFIG.testRepoUrl,
        branch: TEST_CONFIG.testBranch,
      },
    });
    const session = await response.json();
    createdSessionIds.push(session.id);

    await page.goto('/docker');

    // Session should be visible with status
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Status badge should be visible
    await expect(
      sessionCard.locator('[data-testid="status-badge"]')
    ).toBeVisible();
  });

  test('should delete a session', async ({ page, request }) => {
    // Create a session via API
    const sessionName = generateSessionName();
    const response = await request.post('/api/sessions', {
      data: {
        name: sessionName,
        repoUrl: TEST_CONFIG.testRepoUrl,
        branch: TEST_CONFIG.testBranch,
      },
    });
    const session = await response.json();
    // Don't add to cleanup since we're deleting in the test

    await page.goto('/docker');

    // Wait for session to appear
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Handle browser confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await sessionCard.locator('[data-testid="delete-button"]').click();

    // Session should be removed from list
    await expect(sessionCard).not.toBeVisible({ timeout: TEST_CONFIG.timeout });
  });

  test('should connect to session terminal', async ({ page, request }) => {
    // Create a session via API
    const sessionName = generateSessionName();
    const response = await request.post('/api/sessions', {
      data: {
        name: sessionName,
        repoUrl: TEST_CONFIG.testRepoUrl,
        branch: TEST_CONFIG.testBranch,
      },
    });
    const session = await response.json();
    createdSessionIds.push(session.id);

    // Start the session to enable terminal connection
    await request.post(`/api/sessions/${session.id}/start`);

    await page.goto('/docker');

    // Wait for session to appear with running status
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Wait for running status (terminal is only available when running)
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Click connect button to show terminal in the same page
    await sessionCard.locator('[data-testid="connect-button"]').click();

    // Terminal component should be visible in the right panel
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });
  });
});

test.describe('Docker Session Actions', () => {
  let sessionId: string;
  let sessionName: string;

  test.beforeEach(async ({ request }) => {
    // Create a session for each test
    sessionName = generateSessionName();
    const response = await request.post('/api/sessions', {
      data: {
        name: sessionName,
        repoUrl: TEST_CONFIG.testRepoUrl,
        branch: TEST_CONFIG.testBranch,
      },
    });
    const session = await response.json();
    sessionId = session.id;
  });

  test.afterEach(async ({ request }) => {
    // Cleanup: Stop and delete the session
    try {
      await request.post(`/api/sessions/${sessionId}/stop`);
    } catch {
      // Ignore if already stopped
    }
    try {
      await request.delete(`/api/sessions/${sessionId}`);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should start a session', async ({ page }) => {
    await page.goto('/docker');

    // Wait for session to appear
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Click start button (if visible - session might already be running or creating)
    const startButton = sessionCard.locator('[data-testid="start-button"]');
    if (await startButton.isVisible()) {
      await startButton.click();

      // Wait for status to change to running
      await expect(
        sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
      ).toBeVisible({ timeout: TEST_CONFIG.timeout });
    }
  });

  test('should stop a running session', async ({ page, request }) => {
    // Start the session first
    await request.post(`/api/sessions/${sessionId}/start`);

    await page.goto('/docker');

    // Wait for session to appear with running status
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Wait for running status
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Click stop button
    const stopButton = sessionCard.locator('[data-testid="stop-button"]');
    await stopButton.click();

    // Wait for status to change to stopped
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Stopped")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });
  });
});

test.describe('Docker Session Terminal', () => {
  let sessionId: string;
  let sessionName: string;

  test.beforeEach(async ({ request }) => {
    // Create and start a session for terminal tests
    sessionName = generateSessionName();
    const response = await request.post('/api/sessions', {
      data: {
        name: sessionName,
        repoUrl: TEST_CONFIG.testRepoUrl,
        branch: TEST_CONFIG.testBranch,
      },
    });
    const session = await response.json();
    sessionId = session.id;

    // Start the session
    await request.post(`/api/sessions/${sessionId}/start`);
  });

  test.afterEach(async ({ request }) => {
    // Cleanup
    try {
      await request.post(`/api/sessions/${sessionId}/stop`);
    } catch {
      // Ignore
    }
    try {
      await request.delete(`/api/sessions/${sessionId}`);
    } catch {
      // Ignore
    }
  });

  test('should display terminal connection status', async ({ page }) => {
    await page.goto(`/docker/sessions/${sessionId}`);

    // Terminal should be visible
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });

    // Connection status should be displayed
    await expect(
      page.locator('text=Connected').or(page.locator('text=Connecting'))
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });
  });

  test('should allow terminal input when connected', async ({ page }) => {
    await page.goto(`/docker/sessions/${sessionId}`);

    // Wait for terminal to be connected
    await expect(page.locator('text=Connected')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });

    // Terminal should accept input
    const terminal = page.locator('[data-testid="terminal"]');
    await terminal.click();

    // Type a command
    await page.keyboard.type('echo test');
    await page.keyboard.press('Enter');

    // Wait for the command to be echoed in terminal (terminal should be responsive)
    await expect(terminal).toContainText('echo test', { timeout: 5000 });
  });
});
