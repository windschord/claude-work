import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkNextBuild, checkPrismaClient, checkDatabase } from '../cli-utils';

describe('cli-utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'cli-utils-test-'));
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkNextBuild', () => {
    it('should return false when .next directory does not exist', () => {
      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when only .next directory exists (no BUILD_ID)', () => {
      mkdirSync(join(testDir, '.next'));

      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when BUILD_ID exists but static directory is missing', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');

      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when BUILD_ID and static exist but server directory is missing', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');
      mkdirSync(join(nextDir, 'static'));

      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return true when all required files and directories exist', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');
      mkdirSync(join(nextDir, 'static'));
      mkdirSync(join(nextDir, 'server'));

      const result = checkNextBuild(testDir);
      expect(result).toBe(true);
    });
  });

  describe('checkPrismaClient', () => {
    it('should return false when Prisma client does not exist', () => {
      const result = checkPrismaClient(testDir);
      expect(result).toBe(false);
    });

    it('should return true when Prisma client directory exists', () => {
      const prismaClientDir = join(testDir, 'node_modules', '.prisma', 'client');
      mkdirSync(prismaClientDir, { recursive: true });

      const result = checkPrismaClient(testDir);
      expect(result).toBe(true);
    });

    it('should return false when only node_modules exists', () => {
      mkdirSync(join(testDir, 'node_modules'));

      const result = checkPrismaClient(testDir);
      expect(result).toBe(false);
    });

    it('should return false when .prisma exists but client does not', () => {
      mkdirSync(join(testDir, 'node_modules', '.prisma'), { recursive: true });

      const result = checkPrismaClient(testDir);
      expect(result).toBe(false);
    });
  });

  describe('checkDatabase', () => {
    it('should return false when database file does not exist', () => {
      const result = checkDatabase(testDir);
      expect(result).toBe(false);
    });

    it('should return true when database file exists', () => {
      const dataDir = join(testDir, 'data');
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'claudework.db'), '');

      const result = checkDatabase(testDir);
      expect(result).toBe(true);
    });

    it('should return false when data directory exists but database file does not', () => {
      mkdirSync(join(testDir, 'data'));

      const result = checkDatabase(testDir);
      expect(result).toBe(false);
    });
  });
});
