import { prisma } from '@/lib/db';
import { Session, Repository } from '@prisma/client';
import { logger } from '@/lib/logger';

export type SessionStatus = 'creating' | 'running' | 'stopped' | 'error';

/**
 * Input for session creation with repository reference
 */
export interface SessionCreateInput {
  name: string;
  repositoryId: string;
  volumeName: string;
  worktreePath?: string;  // ローカルリポジトリ時のみ
  branch: string;         // session/xxx形式
  parentBranch: string;
}

/**
 * Session with repository information included
 */
export type SessionWithRepository = Session & {
  repository: Repository;
};

export class SessionManager {
  /**
   * Create a new session
   * Creates a session linked to a repository
   */
  async create(input: SessionCreateInput): Promise<Session> {
    logger.info('Creating session', {
      name: input.name,
      repositoryId: input.repositoryId,
      branch: input.branch,
      parentBranch: input.parentBranch,
    });

    const session = await prisma.session.create({
      data: {
        name: input.name,
        repositoryId: input.repositoryId,
        volumeName: input.volumeName,
        worktreePath: input.worktreePath || null,
        branch: input.branch,
        parentBranch: input.parentBranch,
        status: 'creating',
      },
    });

    logger.info('Session created', {
      id: session.id,
      name: session.name,
      repositoryId: input.repositoryId,
      branch: session.branch,
    });

    return session;
  }

  async findById(id: string): Promise<SessionWithRepository | null> {
    const session = await prisma.session.findUnique({
      where: { id },
      include: { repository: true },
    });
    return session;
  }

  async findAll(): Promise<SessionWithRepository[]> {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: { repository: true },
    });
    return sessions;
  }

  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    logger.info('Updating session status', { id, status });
    await prisma.session.update({
      where: { id },
      data: { status },
    });
    logger.info('Session status updated', { id, status });
  }

  async updateContainerId(id: string, containerId: string): Promise<void> {
    logger.info('Updating session containerId', { id, containerId });
    await prisma.session.update({
      where: { id },
      data: { containerId },
    });
    logger.info('Session containerId updated', { id, containerId });
  }

  async delete(id: string): Promise<void> {
    logger.info('Deleting session', { id });
    await prisma.session.delete({
      where: { id },
    });
    logger.info('Session deleted', { id });
  }
}
