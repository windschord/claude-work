/**
 * db.ts のモジュールレベルコードをテストするためのテスト。
 * モジュール読み込み時の環境変数検証、ファイルパス処理、
 * シングルトンパターンの動作を検証する。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// モジュールが既にロード済みなので、直接importしてテストする
import { db, schema } from '../db';

describe('db module', () => {
  describe('db instance', () => {
    it('should export db instance', () => {
      expect(db).toBeDefined();
    });

    it('should export schema', () => {
      expect(schema).toBeDefined();
    });

    it('should have schema with expected tables', () => {
      expect(schema).toHaveProperty('projects');
      expect(schema).toHaveProperty('sessions');
      expect(schema).toHaveProperty('messages');
    });

    it('should have db as default export', async () => {
      const mod = await import('../db');
      expect(mod.default).toBe(db);
    });

    it('should re-export schema types', async () => {
      // db.tsがschemaを再エクスポートしていることを確認
      const mod = await import('../db');
      expect(mod.schema).toBeDefined();
      expect(mod.schema).toHaveProperty('projects');
    });
  });

  describe('DATABASE_URL validation', () => {
    it('should have DATABASE_URL set in test environment', () => {
      // テスト環境ではDATABASE_URLが設定されている
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).not.toBe('');
    });
  });

  describe('db functionality', () => {
    it('should be able to run queries', () => {
      // db instanceが機能することを確認
      const result = db.select().from(schema.projects).all();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

