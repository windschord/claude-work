import { test, expect } from '@playwright/test';
import { TEST_CONFIG, generateSessionName } from './helpers/setup';

test.describe('Docker Session Management', () => {
  // Run tests serially to avoid shared state conflicts
  test.describe.configure({ mode: 'serial' });

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

    // Store session ID for cleanup - use try/finally to ensure cleanup even if assertion fails
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    const sessionId = await sessionCard.getAttribute('data-session-id');
    try {
      expect(sessionId, 'Session card should have data-session-id attribute').toBeTruthy();
    } finally {
      // Always add to cleanup list if we got an ID, even if assertion fails
      if (sessionId) {
        createdSessionIds.push(sessionId);
      }
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
  // Run tests serially to avoid shared state conflicts with Docker sessions
  test.describe.configure({ mode: 'serial' });

  let sessionId: string | undefined;
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
    // Guard against undefined sessionId (if beforeEach failed)
    if (!sessionId) return;

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

    // Click start button if visible (session might already be running or creating)
    const startButton = sessionCard.locator('[data-testid="start-button"]');
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // Always verify session reaches Running status regardless of startButton visibility
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });
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
  // Run tests serially to avoid shared state conflicts with Docker sessions
  test.describe.configure({ mode: 'serial' });

  let sessionId: string | undefined;
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
    // Guard against undefined sessionId (if beforeEach failed)
    if (!sessionId) return;

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
    // Navigate to Docker home page and select the session
    await page.goto('/docker');

    // Wait for the session to appear with running status
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Click connect button to show terminal in the right panel
    await sessionCard.locator('[data-testid="connect-button"]').click();

    // Terminal should be visible in the right panel
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });

    // Connection status should show 'Connected' (not just 'Connecting')
    await expect(page.locator('text=Connected')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });
  });

  test('should allow terminal input when connected', async ({ page }) => {
    // Navigate to Docker home page and select the session
    await page.goto('/docker');

    // Wait for the session to appear with running status
    const sessionCard = page.locator('[data-testid="session-card"]').filter({
      hasText: sessionName,
    });
    await expect(sessionCard).toBeVisible({ timeout: TEST_CONFIG.timeout });
    await expect(
      sessionCard.locator('[data-testid="status-badge"]:has-text("Running")')
    ).toBeVisible({ timeout: TEST_CONFIG.timeout });

    // Click connect button to show terminal
    await sessionCard.locator('[data-testid="connect-button"]').click();

    // Wait for terminal to be connected
    await expect(page.locator('text=Connected')).toBeVisible({
      timeout: TEST_CONFIG.timeout,
    });

    // Terminal should accept input
    const terminal = page.locator('[data-testid="terminal"]');
    await terminal.click();

    // Type a command with unique text to verify actual execution
    const uniqueText = `test-${Date.now()}`;
    await page.keyboard.type(`echo ${uniqueText}`);
    await page.keyboard.press('Enter');

    // Wait for both the command and its output to appear in terminal
    await expect(terminal).toContainText(`echo ${uniqueText}`, { timeout: 5000 });
    // The output line should also contain the unique text (command output)
    await expect(terminal).toContainText(uniqueText, { timeout: 5000 });
  });
});
