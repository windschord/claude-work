import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkNextBuild, checkDrizzle, checkDatabase, findBinDir } from '../cli-utils';

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

  describe('checkDrizzle', () => {
    it('should return false when drizzle-orm does not exist', () => {
      const result = checkDrizzle(testDir);
      expect(result).toBe(false);
    });

    it('should return true when drizzle-orm directory exists', () => {
      const drizzleDir = join(testDir, 'node_modules', 'drizzle-orm');
      mkdirSync(drizzleDir, { recursive: true });

      const result = checkDrizzle(testDir);
      expect(result).toBe(true);
    });

    it('should return false when only node_modules exists', () => {
      mkdirSync(join(testDir, 'node_modules'));

      const result = checkDrizzle(testDir);
      expect(result).toBe(false);
    });

    it('should return true when drizzle-orm exists in parent node_modules (npx flat structure)', () => {
      // Simulate npx cache structure:
      // testDir/node_modules/drizzle-orm/  (flat install)
      // testDir/node_modules/claude-work/  (projectRoot)
      const parentNodeModules = join(testDir, 'node_modules');
      mkdirSync(join(parentNodeModules, 'drizzle-orm'), { recursive: true });
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });

      const result = checkDrizzle(projectRoot);
      expect(result).toBe(true);
    });

    it('should return false when drizzle-orm does not exist in any ancestor node_modules', () => {
      const parentNodeModules = join(testDir, 'node_modules');
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });

      const result = checkDrizzle(projectRoot);
      expect(result).toBe(false);
    });
  });

  describe('findBinDir', () => {
    it('should return local .bin when it exists in projectRoot', () => {
      const binDir = join(testDir, 'node_modules', '.bin');
      mkdirSync(binDir, { recursive: true });

      const result = findBinDir(testDir);
      expect(result).toBe(binDir);
    });

    it('should return parent .bin when projectRoot has no .bin (npx flat structure)', () => {
      // Simulate npx cache: .bin is in parent node_modules
      const parentNodeModules = join(testDir, 'node_modules');
      const parentBinDir = join(parentNodeModules, '.bin');
      mkdirSync(parentBinDir, { recursive: true });
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });

      const result = findBinDir(projectRoot);
      expect(result).toBe(parentBinDir);
    });

    it('should return local .bin as fallback when not found anywhere', () => {
      const result = findBinDir(testDir);
      expect(result).toBe(join(testDir, 'node_modules', '.bin'));
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
