import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

export default async function setup() {
  // Create a temporary test database file
  const testDbPath = path.join(process.cwd(), 'data', 'test.db');
  const testDbDir = path.dirname(testDbPath);

  // Ensure directory exists
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Convert to file URL for DATABASE_URL
  const testDbUrl = `file:${testDbPath}`;

  // Set DATABASE_URL for drizzle-kit
  process.env.DATABASE_URL = testDbUrl;

  // Initialize database schema using drizzle-kit push
  const result = spawnSync('npx', ['drizzle-kit', 'push'], {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDbUrl },
  });

  if (result.error || result.status !== 0) {
    console.error('Failed to initialize test database:');
    if (result.error) console.error('Error:', result.error.message);
    if (result.stdout) console.error('stdout:', result.stdout);
    if (result.stderr) console.error('stderr:', result.stderr);
    throw new Error(result.stderr || result.error?.message || 'Failed to initialize test database');
  }

  console.log(`Test database initialized at ${testDbPath}`);

  return async () => {
    // Teardown: No explicit disconnect needed for better-sqlite3
    // The database connection is synchronous and closed automatically
    console.log('Test database teardown complete');
  };
}
