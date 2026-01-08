/**
 * Docker container-based session types
 */

/**
 * Docker session status
 */
export type DockerSessionStatus = 'creating' | 'running' | 'stopped' | 'error';

/**
 * Docker session type
 */
export interface DockerSession {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Docker container ID (null if not yet created) */
  containerId: string | null;
  /** Docker volume name */
  volumeName: string;
  /** Git repository URL */
  repoUrl: string;
  /** Git branch name */
  branch: string;
  /** Session status */
  status: DockerSessionStatus;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Create session request
 */
export interface CreateDockerSessionRequest {
  name: string;
  repoUrl: string;
  branch: string;
}

/**
 * Session warning info
 */
export interface SessionWarning {
  hasUncommittedChanges: boolean;
  unpushedCommitCount: number;
}
