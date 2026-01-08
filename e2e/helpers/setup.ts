/**
 * E2E Test Helpers for Docker Session Architecture
 */

/**
 * Test configuration
 */
export const TEST_CONFIG = {
  // Use a public test repository (GitHub)
  testRepoUrl: 'https://github.com/octocat/Hello-World.git',
  testBranch: 'master',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 30000,
};

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

/**
 * Generate a unique session name for testing
 */
export function generateSessionName(): string {
  return `test-session-${Date.now()}`;
}
