import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { sessions, projects, executionEnvironments } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Session State Schema Tests', () => {
  let testProjectId: string;
  let testEnvironmentId: string;

  beforeEach(async () => {
    // テスト用プロジェクトを作成
    const [project] = await db.insert(projects).values({
      name: 'Test Project',
      path: '/tmp/test-project',
    }).returning();
    testProjectId = project.id;

    // テスト用環境を作成
    const [environment] = await db.insert(executionEnvironments).values({
      name: 'Test Environment',
      type: 'HOST',
      config: '{}',
    }).returning();
    testEnvironmentId = environment.id;
  });

  afterEach(async () => {
    // テストデータをクリーンアップ
    await db.delete(sessions).where(eq(sessions.project_id, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
    await db.delete(executionEnvironments).where(eq(executionEnvironments.id, testEnvironmentId));
  });

  describe('スキーマ変更の検証', () => {
    it('should have new state management fields in schema', async () => {
      // sessionsテーブルに新規フィールドが含まれていることを確認
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
        // 新規フィールド
        active_connections: 0,
        session_state: 'ACTIVE',
      }).returning();

      expect(session).toHaveProperty('active_connections');
      expect(session).toHaveProperty('destroy_at');
      expect(session).toHaveProperty('session_state');
      expect(session).toHaveProperty('last_activity_at');
    });

    it('should have default values set correctly', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      expect(session.active_connections).toBe(0);
      expect(session.session_state).toBe('ACTIVE');
      expect(session.destroy_at).toBeNull();
    });
  });

  describe('セッション作成のテスト', () => {
    it('should create a new session with default values', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      expect(session.session_state).toBe('ACTIVE');
      expect(session.active_connections).toBe(0);
      expect(session.destroy_at).toBeNull();
    });

    it('should initialize session_state as ACTIVE', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      expect(session.session_state).toBe('ACTIVE');
    });

    it('should initialize active_connections as 0', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      expect(session.active_connections).toBe(0);
    });
  });

  describe('状態更新のテスト', () => {
    it('should update session_state', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      await db.update(sessions)
        .set({ session_state: 'IDLE' })
        .where(eq(sessions.id, session.id));

      const [updated] = await db.select()
        .from(sessions)
        .where(eq(sessions.id, session.id));

      expect(updated.session_state).toBe('IDLE');
    });

    it('should increment/decrement active_connections', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      // インクリメント
      await db.update(sessions)
        .set({ active_connections: session.active_connections + 1 })
        .where(eq(sessions.id, session.id));

      let [updated] = await db.select()
        .from(sessions)
        .where(eq(sessions.id, session.id));

      expect(updated.active_connections).toBe(1);

      // デクリメント
      await db.update(sessions)
        .set({ active_connections: updated.active_connections - 1 })
        .where(eq(sessions.id, session.id));

      [updated] = await db.select()
        .from(sessions)
        .where(eq(sessions.id, session.id));

      expect(updated.active_connections).toBe(0);
    });

    it('should set destroy_at', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      const destroyAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.update(sessions)
        .set({ destroy_at: destroyAt })
        .where(eq(sessions.id, session.id));

      const [updated] = await db.select()
        .from(sessions)
        .where(eq(sessions.id, session.id));

      expect(updated.destroy_at).not.toBeNull();
      expect(updated.destroy_at?.getTime()).toBeCloseTo(destroyAt.getTime(), -2);
    });

    it('should update last_activity_at', async () => {
      const [session] = await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'test-session',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
      }).returning();

      const newActivityTime = new Date();

      await db.update(sessions)
        .set({ last_activity_at: newActivityTime })
        .where(eq(sessions.id, session.id));

      const [updated] = await db.select()
        .from(sessions)
        .where(eq(sessions.id, session.id));

      expect(updated.last_activity_at).not.toBeNull();
      expect(updated.last_activity_at?.getTime()).toBeCloseTo(newActivityTime.getTime(), -2);
    });
  });

  describe('インデックスのテスト', () => {
    it('should search sessions by session_state', async () => {
      // 複数のセッションを作成
      await db.insert(sessions).values([
        {
          project_id: testProjectId,
          name: 'active-session',
          status_legacy: 'running',
          worktree_path: '/tmp/worktree1',
          branch_name: 'main',
          environment_id: testEnvironmentId,
          session_state: 'ACTIVE',
        },
        {
          project_id: testProjectId,
          name: 'idle-session',
          status_legacy: 'running',
          worktree_path: '/tmp/worktree2',
          branch_name: 'main',
          environment_id: testEnvironmentId,
          session_state: 'IDLE',
        },
      ]);

      const activeSessions = await db.select()
        .from(sessions)
        .where(eq(sessions.session_state, 'ACTIVE'));

      expect(activeSessions.length).toBeGreaterThanOrEqual(1);
      expect(activeSessions.every(s => s.session_state === 'ACTIVE')).toBe(true);
    });

    it('should search sessions by destroy_at', async () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000);

      await db.insert(sessions).values({
        project_id: testProjectId,
        name: 'destroy-scheduled',
        status_legacy: 'running',
        worktree_path: '/tmp/worktree',
        branch_name: 'main',
        environment_id: testEnvironmentId,
        destroy_at: futureTime,
      });

      const sessionsWithTimer = await db.select()
        .from(sessions)
        .where(eq(sessions.project_id, testProjectId));

      const withDestroyAt = sessionsWithTimer.filter(s => s.destroy_at !== null);
      expect(withDestroyAt.length).toBeGreaterThanOrEqual(1);
    });

    it('should sort sessions by last_activity_at', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60 * 1000);

      await db.insert(sessions).values([
        {
          project_id: testProjectId,
          name: 'recent-session',
          status_legacy: 'running',
          worktree_path: '/tmp/worktree1',
          branch_name: 'main',
          environment_id: testEnvironmentId,
          last_activity_at: now,
        },
        {
          project_id: testProjectId,
          name: 'old-session',
          status_legacy: 'running',
          worktree_path: '/tmp/worktree2',
          branch_name: 'main',
          environment_id: testEnvironmentId,
          last_activity_at: earlier,
        },
      ]);

      const sortedSessions = await db.select()
        .from(sessions)
        .where(eq(sessions.project_id, testProjectId))
        .orderBy(sessions.last_activity_at);

      expect(sortedSessions.length).toBeGreaterThanOrEqual(2);
      // 古い順にソートされている
      if (sortedSessions.length >= 2) {
        const first = sortedSessions[0].last_activity_at?.getTime() ?? 0;
        const second = sortedSessions[1].last_activity_at?.getTime() ?? 0;
        expect(first).toBeLessThanOrEqual(second);
      }
    });
  });
});
