import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

export default async function setup() {
  // Create a temporary test database file
  const testDbPath = path.join(process.cwd(), 'prisma', 'data', 'test.db');
  const testDbDir = path.dirname(testDbPath);

  // Ensure directory exists
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Convert to file URL (handles Windows backslashes correctly)
  const testDbUrl = pathToFileURL(testDbPath).href;

  // Initialize database schema using prisma db push
  const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    encoding: 'utf-8',
    cwd: process.cwd(),
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
    // Teardown: Disconnect all Prisma clients
    const { prisma } = await import('./src/lib/db');
    await prisma.$disconnect();
    console.log('Test database connections closed');
  };
}
