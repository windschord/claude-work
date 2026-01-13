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
 * Repository type for session
 */
export interface SessionRepository {
  id: string;
  name: string;
  type: 'local' | 'remote';
  path: string | null;
  url: string | null;
  defaultBranch: string;
}

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
  /** Repository ID */
  repositoryId: string;
  /** Associated repository */
  repository: SessionRepository;
  /** Git branch name (session/<name> format) */
  branch: string;
  /** Parent branch name */
  parentBranch: string;
  /** Worktree path (for local repository sessions) */
  worktreePath: string | null;
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
  /** Session name */
  name: string;
  /** Repository ID to create session from */
  repositoryId: string;
  /** Parent branch to base the session on */
  parentBranch: string;
}

/**
 * Session warning info
 */
export interface SessionWarning {
  hasUncommittedChanges: boolean;
  unpushedCommitCount: number;
}
