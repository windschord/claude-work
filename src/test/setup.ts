import '@testing-library/jest-dom';
import path from 'path';

// Set up test environment variables
const testDbPath = path.join(process.cwd(), 'data', 'test.db');
process.env.DATABASE_URL = `file:${testDbPath}`;

// Mock ResizeObserver for Headless UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Notification API for notification tests
class MockNotification {
  static permission: NotificationPermission = 'default';
  constructor(_title: string, _options?: NotificationOptions) {
    // Mock constructor
  }
}

Object.defineProperty(global, 'Notification', {
  value: MockNotification,
  writable: true,
});
