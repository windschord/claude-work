import { prisma } from '@/lib/db';
import { Session } from '@prisma/client';
import { logger } from '@/lib/logger';

export type SessionStatus = 'creating' | 'running' | 'stopped' | 'error';

export interface SessionCreateInput {
  name: string;
  volumeName: string;
  repoUrl: string;
  branch: string;
}

export class SessionManager {
  async create(input: SessionCreateInput): Promise<Session> {
    logger.info('Creating session', { name: input.name });
    const session = await prisma.session.create({
      data: {
        name: input.name,
        volumeName: input.volumeName,
        repoUrl: input.repoUrl,
        branch: input.branch,
        status: 'creating',
      },
    });
    logger.info('Session created', { id: session.id, name: session.name });
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const session = await prisma.session.findUnique({
      where: { id },
    });
    return session;
  }

  async findAll(): Promise<Session[]> {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
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
