import { db, schema } from '../../src/lib/db';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2Eテスト用のデータベースリセット関数
 *
 * 以下のデータを削除します:
 * - すべてのセッション
 * - すべてのプロジェクト
 * - 関連するworktreeディレクトリ
 *
 * Note: executionEnvironmentsは削除しない（システムデータのため）
 */
export async function resetDatabase(): Promise<void> {
  try {
    // 1. すべてのセッションを削除
    db.delete(schema.sessions).run();

    // 2. すべてのプロジェクトを削除
    db.delete(schema.projects).run();

    // 3. .worktreesディレクトリをクリーンアップ
    const worktreesDir = path.join(process.cwd(), '.worktrees');
    if (fs.existsSync(worktreesDir)) {
      const entries = fs.readdirSync(worktreesDir);
      for (const entry of entries) {
        const entryPath = path.join(worktreesDir, entry);
        if (fs.statSync(entryPath).isDirectory()) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      }
    }

    console.log('[E2E] Database reset completed');
  } catch (error) {
    console.error('[E2E] Database reset failed:', error);
    throw error;
  }
}

/**
 * 特定のプロジェクト名に一致するプロジェクトを削除
 *
 * @param projectName - 削除対象のプロジェクト名
 */
export async function deleteProjectByName(projectName: string): Promise<void> {
  try {
    const projects = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.name, projectName))
      .all();

    for (const project of projects) {
      // 関連するセッションを削除
      db
        .delete(schema.sessions)
        .where(eq(schema.sessions.project_id, project.id))
        .run();

      // プロジェクトを削除
      db.delete(schema.projects).where(eq(schema.projects.id, project.id)).run();
    }

    console.log(`[E2E] Deleted ${projects.length} projects with name: ${projectName}`);
  } catch (error) {
    console.error('[E2E] Delete project failed:', error);
    throw error;
  }
}
