import { prisma } from '@/lib/db';
import { Session } from '@prisma/client';
import { logger } from '@/lib/logger';

export type SessionStatus = 'creating' | 'running' | 'stopped' | 'error';

/**
 * Base input for session creation
 */
interface SessionCreateInputBase {
  name: string;
  volumeName: string;
}

/**
 * Input for creating a session from a remote git repository
 */
export interface SessionCreateInputRemote extends SessionCreateInputBase {
  sourceType: 'remote';
  repoUrl: string;
  branch: string;
  localPath?: never;
}

/**
 * Input for creating a session from a local directory
 */
export interface SessionCreateInputLocal extends SessionCreateInputBase {
  sourceType: 'local';
  localPath: string;
  repoUrl?: never;
  branch?: string; // Optional: can be used for default branch name
}

/**
 * Union type for session creation input
 */
export type SessionCreateInput = SessionCreateInputRemote | SessionCreateInputLocal;

/**
 * Legacy input type for backward compatibility
 * @deprecated Use SessionCreateInput with sourceType instead
 */
export interface SessionCreateInputLegacy {
  name: string;
  volumeName: string;
  repoUrl: string;
  branch: string;
}

export class SessionManager {
  /**
   * Create a new session
   * Supports both remote git repository and local directory sources
   */
  async create(input: SessionCreateInput | SessionCreateInputLegacy): Promise<Session> {
    // Handle legacy input (backward compatibility)
    const normalizedInput = this.normalizeCreateInput(input);

    logger.info('Creating session', {
      name: normalizedInput.name,
      sourceType: normalizedInput.sourceType,
    });

    let session: Session;

    if (normalizedInput.sourceType === 'local') {
      // Create session from local directory
      session = await prisma.session.create({
        data: {
          name: normalizedInput.name,
          volumeName: normalizedInput.volumeName,
          localPath: normalizedInput.localPath,
          repoUrl: null,
          branch: normalizedInput.branch || 'main', // Default branch for local
          status: 'creating',
        },
      });
      logger.info('Session created from local path', {
        id: session.id,
        name: session.name,
        localPath: normalizedInput.localPath,
      });
    } else {
      // Create session from remote git repository
      session = await prisma.session.create({
        data: {
          name: normalizedInput.name,
          volumeName: normalizedInput.volumeName,
          repoUrl: normalizedInput.repoUrl,
          localPath: null,
          branch: normalizedInput.branch,
          status: 'creating',
        },
      });
      logger.info('Session created from remote repository', {
        id: session.id,
        name: session.name,
        repoUrl: normalizedInput.repoUrl,
      });
    }

    return session;
  }

  /**
   * Normalize input to handle legacy format
   * @private
   */
  private normalizeCreateInput(input: SessionCreateInput | SessionCreateInputLegacy): SessionCreateInput {
    // Check if input has sourceType (new format)
    if ('sourceType' in input) {
      return input as SessionCreateInput;
    }

    // Legacy format - treat as remote
    const legacyInput = input as SessionCreateInputLegacy;
    return {
      sourceType: 'remote',
      name: legacyInput.name,
      volumeName: legacyInput.volumeName,
      repoUrl: legacyInput.repoUrl,
      branch: legacyInput.branch,
    };
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
