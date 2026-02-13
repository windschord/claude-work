/**
 * バリデーション関数
 * プロジェクト名、リポジトリURL、cloneLocationのバリデーション
 */

const VALID_PROJECT_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_PROJECT_NAME_LENGTH = 255;
const VALID_GIT_URL = /^(https:\/\/|git@)/;

/**
 * プロジェクト名のバリデーション
 */
export function validateProjectName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error('Project name is required');
  }

  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`);
  }

  if (name.includes('..') || name.startsWith('/')) {
    throw new Error('Invalid project name: path traversal detected');
  }

  if (!VALID_PROJECT_NAME.test(name)) {
    throw new Error('Invalid project name: only alphanumeric characters, hyphens, and underscores are allowed');
  }
}

/**
 * リポジトリURLのバリデーション
 */
export function validateRepositoryUrl(url: string): void {
  if (!url || url.length === 0) {
    throw new Error('Repository URL is required');
  }

  if (url.startsWith('file://') || url.startsWith('/')) {
    throw new Error('Invalid repository URL: local paths are not allowed');
  }

  if (!VALID_GIT_URL.test(url)) {
    throw new Error('Invalid repository URL: must be HTTPS or SSH format');
  }
}

/**
 * cloneLocationのバリデーション
 */
export function validateCloneLocation(cloneLocation?: string): 'host' | 'docker' {
  if (!cloneLocation) {
    return 'docker'; // デフォルト値
  }

  if (cloneLocation !== 'host' && cloneLocation !== 'docker') {
    throw new Error(`Invalid cloneLocation: must be 'host' or 'docker'`);
  }

  return cloneLocation;
}

/**
 * タイムアウト値（分）のバリデーション
 */
export function validateTimeoutMinutes(minutes: number): void {
  if (!Number.isInteger(minutes)) {
    throw new Error('Timeout must be an integer');
  }

  if (minutes < 1 || minutes > 30) {
    throw new Error('Timeout must be between 1 and 30 minutes');
  }
}
