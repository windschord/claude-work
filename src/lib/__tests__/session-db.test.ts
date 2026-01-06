import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Session Database Model', () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./test.db',
        },
      },
    });
    // Push schema to test database
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      container_id TEXT,
      volume_name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      branch TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'creating',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    // Clear any existing data
    await prisma.$executeRaw`DELETE FROM sessions`;
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('should create a session with required fields', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'test-session',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      },
    });

    expect(session.id).toBeDefined();
    expect(session.name).toBe('test-session');
    expect(session.volumeName).toBe('vol-test-123');
    expect(session.repoUrl).toBe('https://github.com/test/repo.git');
    expect(session.branch).toBe('main');
    expect(session.status).toBe('creating');
    expect(session.containerId).toBeNull();
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  it('should create a session with containerId', async () => {
    const session = await prisma.session.create({
      data: {
        name: 'running-session',
        containerId: 'container-abc123',
        volumeName: 'vol-running-456',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'feature/test',
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
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
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
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
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
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
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
          repoUrl: 'https://github.com/test/repo1.git',
          branch: 'main',
          status: 'running',
        },
        {
          name: 'session-2',
          volumeName: 'vol-2',
          repoUrl: 'https://github.com/test/repo2.git',
          branch: 'develop',
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
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          status: 'running',
        },
        {
          name: 'stopped-1',
          volumeName: 'vol-s1',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          status: 'stopped',
        },
        {
          name: 'running-2',
          volumeName: 'vol-r2',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
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
});
