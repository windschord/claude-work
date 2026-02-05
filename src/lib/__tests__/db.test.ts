import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db, schema } from '../../lib/db';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const { projects, sessions, messages } = schema;

describe('Database Tests', () => {
  beforeAll(() => {
    // データベースディレクトリを作成
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // SQLiteで外部キー制約を有効化
    db.run(sql`PRAGMA foreign_keys = ON`);
  });

  beforeEach(() => {
    // 各テスト前にデータベースをクリーンアップ
    db.delete(messages).run();
    db.delete(sessions).run();
    db.delete(projects).run();
  });

  describe('Project CRUD', () => {
    it('should create a project', () => {
      const result = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project',
      }).returning().get();

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Project');
      expect(result.path).toBe('/path/to/project');
    });

    it('should read a project', () => {
      const created = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const found = db.select().from(projects).where(eq(projects.id, created.id)).get();

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Project');
    });

    it('should update a project', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const originalTime = project.updated_at.getTime();

      // 異なる時刻を設定するため、明示的に新しいDateを作成
      const newDate = new Date(originalTime + 1000);

      const updated = db.update(projects)
        .set({ name: 'Updated Project', updated_at: newDate })
        .where(eq(projects.id, project.id))
        .returning()
        .get();

      expect(updated.name).toBe('Updated Project');
      expect(updated.updated_at.getTime()).toBeGreaterThan(originalTime);
    });

    it('should delete a project', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      db.delete(projects).where(eq(projects.id, project.id)).run();

      const found = db.select().from(projects).where(eq(projects.id, project.id)).get();

      expect(found).toBeUndefined();
    });
  });

  describe('Session CRUD', () => {
    it('should create a session', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.status).toBe('running');
    });

    it('should read a session', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const created = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      const found = db.select().from(sessions).where(eq(sessions.id, created.id)).get();

      expect(found).not.toBeUndefined();
      expect(found?.name).toBe('Test Session');
    });

    it('should update a session', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      const updated = db.update(sessions)
        .set({ status: 'completed' })
        .where(eq(sessions.id, session.id))
        .returning()
        .get();

      expect(updated.status).toBe('completed');
    });

    it('should delete a session', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      db.delete(sessions).where(eq(sessions.id, session.id)).run();

      const found = db.select().from(sessions).where(eq(sessions.id, session.id)).get();

      expect(found).toBeUndefined();
    });
  });

  describe('Message CRUD', () => {
    it('should create a message', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      const message = db.insert(messages).values({
        session_id: session.id,
        role: 'user',
        content: 'Hello, Claude!'
      }).returning().get();

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello, Claude!');
    });

    it('should read a message', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      const created = db.insert(messages).values({
        session_id: session.id,
        role: 'user',
        content: 'Hello, Claude!'
      }).returning().get();

      const found = db.select().from(messages).where(eq(messages.id, created.id)).get();

      expect(found).not.toBeUndefined();
      expect(found?.content).toBe('Hello, Claude!');
    });
  });

  describe('CASCADE behavior', () => {
    it('should cascade delete sessions when project is deleted', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      db.delete(projects).where(eq(projects.id, project.id)).run();

      const foundSession = db.select().from(sessions).where(eq(sessions.id, session.id)).get();

      expect(foundSession).toBeUndefined();
    });

    it('should cascade delete messages when session is deleted', () => {
      const project = db.insert(projects).values({
        name: 'Test Project',
        path: '/path/to/project'
      }).returning().get();

      const session = db.insert(sessions).values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: '/path/to/worktree',
        branch_name: 'feature-test'
      }).returning().get();

      const message = db.insert(messages).values({
        session_id: session.id,
        role: 'user',
        content: 'Hello!'
      }).returning().get();

      db.delete(sessions).where(eq(sessions.id, session.id)).run();

      const foundMessage = db.select().from(messages).where(eq(messages.id, message.id)).get();

      expect(foundMessage).toBeUndefined();
    });
  });
});
