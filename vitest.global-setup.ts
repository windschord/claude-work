import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function setup() {
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

  // Initialize database schema using prisma db push
  try {
    execSync(`DATABASE_URL="file:${testDbPath}" npx prisma db push --skip-generate --accept-data-loss`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    console.log(`Test database initialized at ${testDbPath}`);
  } catch (error: any) {
    console.error('Failed to initialize test database:');
    console.error('Error message:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    throw error;
  }
}
