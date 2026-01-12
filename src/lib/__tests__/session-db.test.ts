import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Session Database Model', () => {
  let prisma: PrismaClient;
  let testRepositoryId: string;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./test.db',
        },
      },
    });
    // Drop and recreate tables to ensure schema matches (handles schema changes)
    await prisma.$executeRaw`DROP TABLE IF EXISTS sessions`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS repositories`;

    // Push schema to test database (matches prisma/schema.prisma)
    await prisma.$executeRaw`CREATE TABLE repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT,
      url TEXT,
      default_branch TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;

    await prisma.$executeRaw`CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      container_id TEXT,
      volume_name TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      worktree_path TEXT,
      parent_branch TEXT,
      branch TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'creating',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repository_id) REFERENCES repositories(id)
    )`;

    // Create a test repository for session tests
    const testRepo = await prisma.repository.create({
      data: {
        name: 'test-repo',
        type: 'remote',
        url: 'https://github.com/test/repo.git',
        defaultBranch: 'main',
      },
    });
    testRepositoryId = testRepo.id;
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('should create a session with required fields', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'test-session',
        volumeName: 'vol-test-123',
        repositoryId: testRepositoryId,
        branch: 'session/test-session',
        parentBranch: 'main',
      },
    });

    expect(session.id).toBeDefined();
    expect(session.name).toBe('test-session');
    expect(session.volumeName).toBe('vol-test-123');
    expect(session.repositoryId).toBe(testRepositoryId);
    expect(session.branch).toBe('session/test-session');
    expect(session.parentBranch).toBe('main');
    expect(session.status).toBe('creating');
    expect(session.containerId).toBeNull();
    expect(session.worktreePath).toBeNull();
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  it('should create a session with containerId', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'running-session',
        containerId: 'container-abc123',
        volumeName: 'vol-running-456',
        repositoryId: testRepositoryId,
        branch: 'session/feature-test',
        parentBranch: 'main',
        status: 'running',
      },
    });

    expect(session.containerId).toBe('container-abc123');
    expect(session.status).toBe('running');
  });

  it('should find session by id', async () => {
    const created = await prisma.session.create({
      data: {
        name: 'findable-session',
        volumeName: 'vol-find-789',
        repositoryId: testRepositoryId,
        branch: 'session/findable',
        parentBranch: 'main',
      },
    });

    const found = await prisma.session.findUnique({
      where: { id: created.id },
    });

    expect(found).not.toBeNull();
    expect(found?.name).toBe('findable-session');
  });

  it('should update session status', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'updatable-session',
        volumeName: 'vol-update-101',
        repositoryId: testRepositoryId,
        branch: 'session/updatable',
        parentBranch: 'main',
      },
    });

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'running',
        containerId: 'container-xyz789',
      },
    });

    expect(updated.status).toBe('running');
    expect(updated.containerId).toBe('container-xyz789');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(session.updatedAt.getTime());
  });

  it('should delete session by id', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'deletable-session',
        volumeName: 'vol-delete-202',
        repositoryId: testRepositoryId,
        branch: 'session/deletable',
        parentBranch: 'main',
      },
    });

    await prisma.session.delete({
      where: { id: session.id },
    });

    const found = await prisma.session.findUnique({
      where: { id: session.id },
    });

    expect(found).toBeNull();
  });

  it('should list all sessions', async () => {
    await prisma.session.createMany({
      data: [
        {
          name: 'session-1',
          volumeName: 'vol-1',
          repositoryId: testRepositoryId,
          branch: 'session/session-1',
          parentBranch: 'main',
          status: 'running',
        },
        {
          name: 'session-2',
          volumeName: 'vol-2',
          repositoryId: testRepositoryId,
          branch: 'session/session-2',
          parentBranch: 'develop',
          status: 'stopped',
        },
      ],
    });

    const sessions = await prisma.session.findMany();

    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.name)).toContain('session-1');
    expect(sessions.map(s => s.name)).toContain('session-2');
  });

  it('should filter sessions by status', async () => {
    await prisma.session.createMany({
      data: [
        {
          name: 'running-1',
          volumeName: 'vol-r1',
          repositoryId: testRepositoryId,
          branch: 'session/running-1',
          parentBranch: 'main',
          status: 'running',
        },
        {
          name: 'stopped-1',
          volumeName: 'vol-s1',
          repositoryId: testRepositoryId,
          branch: 'session/stopped-1',
          parentBranch: 'main',
          status: 'stopped',
        },
        {
          name: 'running-2',
          volumeName: 'vol-r2',
          repositoryId: testRepositoryId,
          branch: 'session/running-2',
          parentBranch: 'main',
          status: 'running',
        },
      ],
    });

    const runningSessions = await prisma.session.findMany({
      where: { status: 'running' },
    });

    expect(runningSessions).toHaveLength(2);
    expect(runningSessions.every(s => s.status === 'running')).toBe(true);
  });

  it('should find session with repository relation', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'relation-session',
        volumeName: 'vol-relation',
        repositoryId: testRepositoryId,
        branch: 'session/relation',
        parentBranch: 'main',
      },
    });

    const found = await prisma.session.findUnique({
      where: { id: session.id },
      include: { repository: true },
    });

    expect(found).not.toBeNull();
    expect(found?.repository).not.toBeNull();
    expect(found?.repository.name).toBe('test-repo');
    expect(found?.repository.type).toBe('remote');
  });

  it('should create a session with worktreePath for local repository', async () => {
    // Create a local repository
    const localRepo = await prisma.repository.create({
      data: {
        name: 'local-repo',
        type: 'local',
        path: '/home/user/projects/local-repo',
        defaultBranch: 'main',
      },
    });

    const session = await prisma.session.create({
      data: {
        name: 'worktree-session',
        volumeName: 'vol-worktree',
        repositoryId: localRepo.id,
        branch: 'session/worktree',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/local-repo-worktree-session',
      },
    });

    expect(session.worktreePath).toBe('/home/user/.claudework/worktrees/local-repo-worktree-session');
  });
});
