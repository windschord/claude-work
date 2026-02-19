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

type DeveloperSettingsRecord = typeof schema.developerSettings.$inferSelect;

// ==================== サービスクラス ====================

export class DeveloperSettingsService {
  /**
   * グローバル設定を取得
   */
  async getGlobalSettings(): Promise<DeveloperSettingsRecord | null> {
    const record = db
      .select()
      .from(schema.developerSettings)
      .where(
        and(
          eq(schema.developerSettings.scope, 'GLOBAL'),
          isNull(schema.developerSettings.project_id),
        )
      )
      .get();

    return record ?? null;
  }

  /**
   * グローバル設定を更新（存在しない場合は新規作成）
   */
  async updateGlobalSettings(data: UpdateSettingsInput): Promise<DeveloperSettingsRecord> {
    const existing = await this.getGlobalSettings();

    if (!existing) {
      return db
        .insert(schema.developerSettings)
        .values({
          scope: 'GLOBAL',
          project_id: null,
          git_username: data.git_username ?? null,
          git_email: data.git_email ?? null,
        })
        .returning()
        .get();
    }

    return db
      .update(schema.developerSettings)
      .set({
        ...(data.git_username !== undefined && { git_username: data.git_username }),
        ...(data.git_email !== undefined && { git_email: data.git_email }),
        updated_at: new Date(),
      })
      .where(eq(schema.developerSettings.id, existing.id))
      .returning()
      .get();
  }

  /**
   * プロジェクト別設定を取得
   */
  async getProjectSettings(projectId: string): Promise<DeveloperSettingsRecord | null> {
    const record = db
      .select()
      .from(schema.developerSettings)
      .where(
        and(
          eq(schema.developerSettings.scope, 'PROJECT'),
          eq(schema.developerSettings.project_id, projectId),
        )
      )
      .get();

    return record ?? null;
  }

  /**
   * プロジェクト別設定を更新（存在しない場合は新規作成）
   */
  async updateProjectSettings(projectId: string, data: UpdateSettingsInput): Promise<DeveloperSettingsRecord> {
    const existing = await this.getProjectSettings(projectId);

    if (!existing) {
      return db
        .insert(schema.developerSettings)
        .values({
          scope: 'PROJECT',
          project_id: projectId,
          git_username: data.git_username ?? null,
          git_email: data.git_email ?? null,
        })
        .returning()
        .get();
    }

    return db
      .update(schema.developerSettings)
      .set({
        ...(data.git_username !== undefined && { git_username: data.git_username }),
        ...(data.git_email !== undefined && { git_email: data.git_email }),
        updated_at: new Date(),
      })
      .where(eq(schema.developerSettings.id, existing.id))
      .returning()
      .get();
  }

  /**
   * プロジェクト別設定を削除
   */
  async deleteProjectSettings(projectId: string): Promise<void> {
    const existing = await this.getProjectSettings(projectId);

    if (!existing) {
      throw new SettingsNotFoundError('PROJECT', projectId);
    }

    db.delete(schema.developerSettings)
      .where(eq(schema.developerSettings.id, existing.id))
      .run();
  }

  /**
   * プロジェクトの有効な設定を取得（優先順位解決済み）
   * フィールドごとにプロジェクト設定 > グローバル設定の優先順位を適用
   */
  async getEffectiveSettings(projectId: string): Promise<EffectiveSettings> {
    const [projectSettings, globalSettings] = await Promise.all([
      this.getProjectSettings(projectId),
      this.getGlobalSettings(),
    ]);

    const resolveField = (
      field: keyof Pick<DeveloperSettingsRecord, 'git_username' | 'git_email'>,
    ): { value: string | null; source: 'project' | 'global' | null } => {
      if (projectSettings?.[field]) {
        return { value: projectSettings[field], source: 'project' };
      }
      if (globalSettings?.[field]) {
        return { value: globalSettings[field], source: 'global' };
      }
      return { value: null, source: null };
    };

    const username = resolveField('git_username');
    const email = resolveField('git_email');

    return {
      git_username: username.value,
      git_email: email.value,
      source: {
        git_username: username.source,
        git_email: email.source,
      },
    };
  }
}
