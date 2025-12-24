import '@testing-library/jest-dom';
import path from 'path';

// Set up test environment variables
const testDbPath = path.join(process.cwd(), 'prisma', 'data', 'test.db');
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.PRISMA_ENGINE_TYPE = 'library';

// Mock ResizeObserver for Headless UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
