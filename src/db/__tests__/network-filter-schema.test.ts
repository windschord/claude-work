import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { executionEnvironments, networkFilterConfigs, networkFilterRules } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

describe('NetworkFilter Schema Tests', () => {
  let testEnvironmentId: string;

  beforeEach(async () => {
    // SQLiteで外部キー制約を有効化
    db.run(sql`PRAGMA foreign_keys = ON`);

    // テスト用環境を作成
    const [environment] = await db.insert(executionEnvironments).values({
      name: 'Test Environment for NetworkFilter',
      type: 'DOCKER',
      config: '{}',
    }).returning();
    testEnvironmentId = environment.id;
  });

  afterEach(async () => {
    // テストデータをクリーンアップ (CASCADE削除で関連レコードも削除される)
    await db.delete(executionEnvironments).where(eq(executionEnvironments.id, testEnvironmentId));
  });

  describe('NetworkFilterConfig テーブル', () => {
    it('レコードを挿入・取得できること', async () => {
      const [config] = await db.insert(networkFilterConfigs).values({
        environment_id: testEnvironmentId,
        enabled: false,
      }).returning();

      expect(config.id).toBeDefined();
      expect(config.environment_id).toBe(testEnvironmentId);
      expect(config.enabled).toBe(false);
      expect(config.created_at).toBeInstanceOf(Date);
      expect(config.updated_at).toBeInstanceOf(Date);

      const found = await db.select()
        .from(networkFilterConfigs)
        .where(eq(networkFilterConfigs.id, config.id))
        .get();

      expect(found).toBeDefined();
      expect(found?.environment_id).toBe(testEnvironmentId);
    });

    it('デフォルト値（enabled=false）が正しく設定されること', async () => {
      const [config] = await db.insert(networkFilterConfigs).values({
        environment_id: testEnvironmentId,
      }).returning();

      expect(config.enabled).toBe(false);
    });

    it('created_at と updated_at のデフォルト値が設定されること', async () => {
      const before = new Date();
      const [config] = await db.insert(networkFilterConfigs).values({
        environment_id: testEnvironmentId,
      }).returning();
      const after = new Date();

      expect(config.created_at).toBeInstanceOf(Date);
      expect(config.updated_at).toBeInstanceOf(Date);
      expect(config.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(config.created_at.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('environment_id が UNIQUE であること', async () => {
      await db.insert(networkFilterConfigs).values({
        environment_id: testEnvironmentId,
      });

      await expect(
        db.insert(networkFilterConfigs).values({
          environment_id: testEnvironmentId,
        })
      ).rejects.toThrow();
    });

    it('environment_id の外部キー制約が機能すること（CASCADE削除）', async () => {
      const [config] = await db.insert(networkFilterConfigs).values({
        environment_id: testEnvironmentId,
      }).returning();

      // 環境を削除
      await db.delete(executionEnvironments).where(eq(executionEnvironments.id, testEnvironmentId));

      // NetworkFilterConfigも削除されていること
      const found = await db.select()
        .from(networkFilterConfigs)
        .where(eq(networkFilterConfigs.id, config.id))
        .get();

      expect(found).toBeUndefined();
    });
  });

  describe('NetworkFilterRule テーブル', () => {
    it('レコードを挿入・取得できること', async () => {
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: 'api.github.com',
        port: 443,
        description: 'GitHub API',
        enabled: true,
      }).returning();

      expect(rule.id).toBeDefined();
      expect(rule.environment_id).toBe(testEnvironmentId);
      expect(rule.target).toBe('api.github.com');
      expect(rule.port).toBe(443);
      expect(rule.description).toBe('GitHub API');
      expect(rule.enabled).toBe(true);
      expect(rule.created_at).toBeInstanceOf(Date);
      expect(rule.updated_at).toBeInstanceOf(Date);

      const found = await db.select()
        .from(networkFilterRules)
        .where(eq(networkFilterRules.id, rule.id))
        .get();

      expect(found).toBeDefined();
      expect(found?.target).toBe('api.github.com');
    });

    it('port が null 許容であること', async () => {
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: '*.npmjs.com',
      }).returning();

      expect(rule.port).toBeNull();
    });

    it('description が null 許容であること', async () => {
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: '*.npmjs.com',
      }).returning();

      expect(rule.description).toBeNull();
    });

    it('デフォルト値（enabled=true）が正しく設定されること', async () => {
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: 'example.com',
      }).returning();

      expect(rule.enabled).toBe(true);
    });

    it('created_at と updated_at のデフォルト値が設定されること', async () => {
      const before = new Date();
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: 'example.com',
      }).returning();
      const after = new Date();

      expect(rule.created_at).toBeInstanceOf(Date);
      expect(rule.updated_at).toBeInstanceOf(Date);
      expect(rule.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(rule.created_at.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('environment_id の外部キー制約が機能すること（CASCADE削除）', async () => {
      const [rule] = await db.insert(networkFilterRules).values({
        environment_id: testEnvironmentId,
        target: 'api.github.com',
      }).returning();

      // 環境を削除
      await db.delete(executionEnvironments).where(eq(executionEnvironments.id, testEnvironmentId));

      // NetworkFilterRuleも削除されていること
      const found = await db.select()
        .from(networkFilterRules)
        .where(eq(networkFilterRules.id, rule.id))
        .get();

      expect(found).toBeUndefined();
    });

    it('同一 environment_id に複数のルールを登録できること', async () => {
      await db.insert(networkFilterRules).values([
        {
          environment_id: testEnvironmentId,
          target: 'api.github.com',
          port: 443,
        },
        {
          environment_id: testEnvironmentId,
          target: 'registry.npmjs.org',
          port: 443,
        },
        {
          environment_id: testEnvironmentId,
          target: '*.pypi.org',
        },
      ]);

      const rules = await db.select()
        .from(networkFilterRules)
        .where(eq(networkFilterRules.environment_id, testEnvironmentId));

      expect(rules.length).toBe(3);
    });
  });
});
