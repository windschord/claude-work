import os from 'os';
import path from 'path';
import { Session } from '@prisma/client';
import { DockerService } from './docker-service';
import { SessionManager, SessionStatus } from './session-manager';
import { logger } from '@/lib/logger';

const DOCKER_IMAGE = 'claudework-session:latest';
const VOLUME_PREFIX = 'claudework-';

export interface CreateSessionOptions {
  name: string;
  repoUrl: string;
  branch: string;
}

export class ContainerManager {
  private dockerService: DockerService;
  private sessionManager: SessionManager;

  constructor() {
    this.dockerService = new DockerService();
    this.sessionManager = new SessionManager();
  }

  async createSession(options: CreateSessionOptions): Promise<Session> {
    logger.info('Creating session', { name: options.name });

    // Check if Docker is running
    const isDockerRunning = await this.dockerService.isDockerRunning();
    if (!isDockerRunning) {
      throw new Error('Docker is not running. Please start Docker and try again.');
    }

    const volumeName = `${VOLUME_PREFIX}${options.name}`;

    // Create volume for workspace persistence
    logger.info('Creating volume', { volumeName });
    await this.dockerService.createVolume(volumeName);

    // Create session record in database
    const session = await this.sessionManager.create({
      name: options.name,
      volumeName,
      repoUrl: options.repoUrl,
      branch: options.branch,
    });

    try {
      // Prepare mount configurations
      const mounts = this.prepareMounts();
      const sshAuthSock = process.env.SSH_AUTH_SOCK;

      // Build environment variables
      const env: Record<string, string> = {
        REPO_URL: options.repoUrl,
        BRANCH: options.branch,
      };

      // Add SSH_AUTH_SOCK if available
      if (sshAuthSock) {
        env.SSH_AUTH_SOCK = '/ssh-agent';
        mounts.push({
          source: sshAuthSock,
          target: '/ssh-agent',
          readOnly: false,
        });
      }

      // Create container
      const containerName = `claudework-${session.id}`;
      const container = await this.dockerService.createContainer({
        image: DOCKER_IMAGE,
        name: containerName,
        env,
        volumes: [
          {
            source: volumeName,
            target: '/workspace',
          },
        ],
        mounts,
      });

      // Update session with container ID
      await this.sessionManager.updateContainerId(session.id, container.id);

      // Start container
      await this.dockerService.startContainer(container.id);

      // Update session status to running
      await this.sessionManager.updateStatus(session.id, 'running');

      logger.info('Session created successfully', {
        sessionId: session.id,
        containerId: container.id,
      });

      // Return updated session
      return await this.sessionManager.findById(session.id) as Session;
    } catch (error) {
      // Update session status to error if container creation fails
      logger.error('Failed to create container', { sessionId: session.id, error });
      await this.sessionManager.updateStatus(session.id, 'error');
      throw error;
    }
  }

  async startSession(sessionId: string): Promise<void> {
    logger.info('Starting session', { sessionId });

    const session = await this.sessionManager.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.containerId) {
      throw new Error(`Container not found for session: ${sessionId}`);
    }

    await this.dockerService.startContainer(session.containerId);
    await this.sessionManager.updateStatus(sessionId, 'running');

    logger.info('Session started', { sessionId });
  }

  async stopSession(sessionId: string): Promise<void> {
    logger.info('Stopping session', { sessionId });

    const session = await this.sessionManager.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.containerId) {
      throw new Error(`Container not found for session: ${sessionId}`);
    }

    await this.dockerService.stopContainer(session.containerId);
    await this.sessionManager.updateStatus(sessionId, 'stopped');

    logger.info('Session stopped', { sessionId });
  }

  async deleteSession(sessionId: string): Promise<void> {
    logger.info('Deleting session', { sessionId });

    const session = await this.sessionManager.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Remove container if exists
    if (session.containerId) {
      try {
        await this.dockerService.removeContainer(session.containerId, true);
      } catch (error) {
        logger.warn('Failed to remove container, it may not exist', {
          containerId: session.containerId,
          error,
        });
      }
    }

    // Remove volume
    try {
      await this.dockerService.removeVolume(session.volumeName);
    } catch (error) {
      logger.warn('Failed to remove volume, it may not exist', {
        volumeName: session.volumeName,
        error,
      });
    }

    // Delete session record
    await this.sessionManager.delete(sessionId);

    logger.info('Session deleted', { sessionId });
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const session = await this.sessionManager.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.containerId) {
      return session.status as SessionStatus;
    }

    try {
      const containerStatus = await this.dockerService.getContainerStatus(session.containerId);

      if (containerStatus.running) {
        return 'running';
      } else {
        return 'stopped';
      }
    } catch {
      return 'error';
    }
  }

  async listSessions(): Promise<Session[]> {
    return await this.sessionManager.findAll();
  }

  private prepareMounts(): { source: string; target: string; readOnly: boolean }[] {
    const homeDir = os.homedir();
    const mounts: { source: string; target: string; readOnly: boolean }[] = [];

    // Claude auth directory
    const claudeDir = path.join(homeDir, '.claude');
    mounts.push({
      source: claudeDir,
      target: '/root/.claude',
      readOnly: true,
    });

    // Git config
    const gitConfig = path.join(homeDir, '.gitconfig');
    mounts.push({
      source: gitConfig,
      target: '/root/.gitconfig',
      readOnly: true,
    });

    return mounts;
  }
}
