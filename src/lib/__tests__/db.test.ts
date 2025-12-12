import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../../lib/db';
import fs from 'fs';
import path from 'path';

describe('Database Tests', () => {
  beforeAll(async () => {
    // データベースディレクトリを作成
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 各テスト前にデータベースをクリーンアップ
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    await prisma.authSession.deleteMany();
  });

  describe('Project CRUD', () => {
    it('should create a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project',
          default_model: 'sonnet',
          run_scripts: JSON.stringify([{ name: 'test', command: 'npm test' }])
        }
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.path).toBe('/path/to/project');
      expect(project.default_model).toBe('sonnet');
    });

    it('should read a project', async () => {
      const created = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const found = await prisma.project.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Project');
    });

    it('should update a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { name: 'Updated Project' }
      });

      expect(updated.name).toBe('Updated Project');
    });

    it('should delete a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      await prisma.project.delete({
        where: { id: project.id }
      });

      const found = await prisma.project.findUnique({
        where: { id: project.id }
      });

      expect(found).toBeNull();
    });
  });

  describe('Session CRUD', () => {
    it('should create a session', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.status).toBe('running');
    });

    it('should read a session', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const created = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      const found = await prisma.session.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Session');
    });

    it('should update a session', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { status: 'completed' }
      });

      expect(updated.status).toBe('completed');
    });

    it('should delete a session', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      await prisma.session.delete({
        where: { id: session.id }
      });

      const found = await prisma.session.findUnique({
        where: { id: session.id }
      });

      expect(found).toBeNull();
    });
  });

  describe('Message CRUD', () => {
    it('should create a message', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      const message = await prisma.message.create({
        data: {
          session_id: session.id,
          role: 'user',
          content: 'Hello, Claude!'
        }
      });

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello, Claude!');
    });

    it('should read a message', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      const created = await prisma.message.create({
        data: {
          session_id: session.id,
          role: 'user',
          content: 'Hello, Claude!'
        }
      });

      const found = await prisma.message.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found?.content).toBe('Hello, Claude!');
    });
  });

  describe('AuthSession CRUD', () => {
    it('should create an auth session', async () => {
      const authSession = await prisma.authSession.create({
        data: {
          id: 'session-123',
          token_hash: 'hash123',
          expires_at: new Date(Date.now() + 86400000) // 24 hours
        }
      });

      expect(authSession.id).toBe('session-123');
      expect(authSession.token_hash).toBe('hash123');
    });

    it('should read an auth session', async () => {
      const created = await prisma.authSession.create({
        data: {
          id: 'session-456',
          token_hash: 'hash456',
          expires_at: new Date(Date.now() + 86400000)
        }
      });

      const found = await prisma.authSession.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found?.token_hash).toBe('hash456');
    });
  });

  describe('CASCADE behavior', () => {
    it('should cascade delete sessions when project is deleted', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      await prisma.project.delete({
        where: { id: project.id }
      });

      const foundSession = await prisma.session.findUnique({
        where: { id: session.id }
      });

      expect(foundSession).toBeNull();
    });

    it('should cascade delete messages when session is deleted', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          path: '/path/to/project'
        }
      });

      const session = await prisma.session.create({
        data: {
          project_id: project.id,
          name: 'Test Session',
          status: 'running',
          model: 'sonnet',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature-test'
        }
      });

      const message = await prisma.message.create({
        data: {
          session_id: session.id,
          role: 'user',
          content: 'Hello!'
        }
      });

      await prisma.session.delete({
        where: { id: session.id }
      });

      const foundMessage = await prisma.message.findUnique({
        where: { id: message.id }
      });

      expect(foundMessage).toBeNull();
    });
  });
});
