import { db, schema } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';

// ==================== エラークラス ====================

export class SettingsNotFoundError extends Error {
  constructor(scope: string, projectId?: string) {
    const target = projectId ? `project ${projectId}` : scope;
    super(`Settings not found: ${target}`);
    this.name = 'SettingsNotFoundError';
  }
}

// ==================== 型定義 ====================

export interface UpdateSettingsInput {
  git_username?: string;
  git_email?: string;
}

export interface EffectiveSettings {
  git_username: string | null;
  git_email: string | null;
  source: {
    git_username: 'project' | 'global' | null;
    git_email: 'project' | 'global' | null;
  };
}

// ==================== サービスクラス ====================

export class DeveloperSettingsService {
  // TODO: implement
}
