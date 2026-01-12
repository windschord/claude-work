/**
 * Docker container-based session types
 */

/**
 * Docker session status
 */
export type DockerSessionStatus = 'creating' | 'running' | 'stopped' | 'error';

/**
 * Source type for session workspace
 */
export type SessionSourceType = 'remote' | 'local';

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
  /** Source type: 'remote' for git repository, 'local' for local directory */
  sourceType: SessionSourceType;
  /** Git repository URL (for remote source) */
  repoUrl: string;
  /** Git branch name (for remote source) */
  branch: string;
  /** Local directory path (for local source) */
  localPath: string | null;
  /** Session status */
  status: DockerSessionStatus;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Base create session request
 */
interface CreateDockerSessionRequestBase {
  name: string;
}

/**
 * Create session request for remote git repository
 */
export interface CreateDockerSessionRequestRemote extends CreateDockerSessionRequestBase {
  sourceType: 'remote';
  repoUrl: string;
  branch: string;
  localPath?: never;
}

/**
 * Create session request for local directory
 */
export interface CreateDockerSessionRequestLocal extends CreateDockerSessionRequestBase {
  sourceType: 'local';
  localPath: string;
  repoUrl?: never;
  branch?: never;
}

/**
 * Create session request (union type)
 */
export type CreateDockerSessionRequest = CreateDockerSessionRequestRemote | CreateDockerSessionRequestLocal;

/**
 * Session warning info
 */
export interface SessionWarning {
  hasUncommittedChanges: boolean;
  unpushedCommitCount: number;
}
