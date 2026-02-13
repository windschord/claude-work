/**
 * バリデーション関数
 * プロジェクト名、リポジトリURL、cloneLocation、PATのバリデーション
 */

const VALID_PROJECT_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_PROJECT_NAME_LENGTH = 255;
const VALID_GIT_URL = /^(https:\/\/|git@)/;
const VALID_PAT_PREFIX = /^(ghp_|github_pat_)/;
const VALID_PAT_CHARS = /^[a-zA-Z0-9_]+$/;
const MIN_PAT_LENGTH = 40;
const MAX_PAT_NAME_LENGTH = 50;

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

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

/**
 * PATフォーマットのバリデーション
 * - ghp_ (Classic PAT) または github_pat_ (Fine-grained PAT) で始まる
 * - 40文字以上
 * - 英数字とアンダースコアのみ
 */
export function validatePATFormat(token: string): ValidationResult {
  const errors: string[] = [];

  if (!token || token.length === 0) {
    return { valid: false, errors: ['PAT is required'] };
  }

  if (!VALID_PAT_PREFIX.test(token)) {
    errors.push('PAT must start with "ghp_" (Classic) or "github_pat_" (Fine-grained)');
  }

  if (token.length < MIN_PAT_LENGTH) {
    errors.push('PAT must be at least 40 characters');
  }

  if (!VALID_PAT_CHARS.test(token)) {
    errors.push('PAT must contain only alphanumeric characters and underscores');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * PAT名のバリデーション
 * - 1文字以上50文字以下
 * - 必須フィールド
 */
export function validatePATName(name: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = name.trim();

  if (!trimmed || trimmed.length === 0) {
    return { valid: false, errors: ['PAT name is required'] };
  }

  if (name.length > MAX_PAT_NAME_LENGTH) {
    errors.push('PAT name must be 50 characters or less');
  }

  return { valid: errors.length === 0, errors };
}
