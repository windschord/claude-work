/**
 * Project-Environment 1対1化マイグレーションスクリプト
 *
 * 実行方法: npx tsx scripts/migrate-env-project-one-to-one.ts
 *
 * 処理内容:
 * 1. 複数プロジェクトに共有されている環境を検出し、プロジェクトごとに複製する
 * 2. NetworkFilterConfig/Rules を複製先の環境にコピーする
 * 3. auth_dir_path ディレクトリを複製先にコピーする（ベストエフォート）
 * 4. environment_id が null のプロジェクトにデフォルト DOCKER 環境を作成する
 * 5. executionEnvironments.project_id の整合性を検証する
 *
 * べき等性: 2回実行しても安全（既に移行済みのレコードをスキップ）
 */

import Database from 'better-sqlite3';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

interface EnvRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  config: string;
  auth_dir_path: string | null;
  project_id: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  environment_id: string | null;
}

interface NetworkFilterConfigRow {
  id: string;
  environment_id: string;
  enabled: number;
}

interface NetworkFilterRuleRow {
  id: string;
  environment_id: string;
  target: string;
  port: number | null;
  description: string | null;
  enabled: number;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * NetworkFilterConfig/Rules を新しい環境IDにコピーする
 */
function cloneNetworkFilter(db: Database.Database, srcEnvId: string, dstEnvId: string): void {
  const srcConfig = db.prepare(
    'SELECT * FROM NetworkFilterConfig WHERE environment_id = ?'
  ).get(srcEnvId) as NetworkFilterConfigRow | undefined;

  if (srcConfig) {
    db.prepare(`
      INSERT INTO NetworkFilterConfig (id, environment_id, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateUUID(), dstEnvId, srcConfig.enabled, Date.now(), Date.now());
  }

  const srcRules = db.prepare(
    'SELECT * FROM NetworkFilterRule WHERE environment_id = ?'
  ).all(srcEnvId) as NetworkFilterRuleRow[];

  for (const rule of srcRules) {
    db.prepare(`
      INSERT INTO NetworkFilterRule (id, environment_id, target, port, description, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateUUID(),
      dstEnvId,
      rule.target,
      rule.port,
      rule.description,
      rule.enabled,
      Date.now(),
      Date.now(),
    );
  }
}

/**
 * auth_dir_path ディレクトリをコピーする（ベストエフォート）
 * テスト環境では Docker API が使えないため、Docker Volume 作成はスキップする
 */
async function cloneAuthDir(
  db: Database.Database,
  originalEnv: EnvRow,
  newEnvId: string,
  environmentsDir: string | null,
): Promise<void> {
  if (originalEnv.auth_dir_path && environmentsDir) {
    const newAuthDirPath = path.join(environmentsDir, newEnvId);
    try {
      await fsPromises.cp(originalEnv.auth_dir_path, newAuthDirPath, { recursive: true });
      db.prepare(
        'UPDATE ExecutionEnvironment SET auth_dir_path = ? WHERE id = ?'
      ).run(newAuthDirPath, newEnvId);
    } catch (err) {
      console.warn(
        `[WARN] auth_dir_path のコピーに失敗しました（ベストエフォート）: ${(err as Error).message}`
      );
    }
  }
  // Docker Volume 作成はスクリプト外でベストエフォートのため、ここではスキップ
}

/**
 * マイグレーション本体
 * テストからも呼び出せるよう db を引数として受け取る
 * @param db - better-sqlite3 の Database インスタンス
 * @param environmentsDir - auth_dir_path のベースディレクトリ（本番用）。null の場合はスキップ
 */
export async function runMigration(
  db: Database.Database,
  environmentsDir: string | null = null,
): Promise<void> {
  // トランザクション内でデータ移行を実行（DB操作のアトミック性を保証）
  db.transaction(() => {
    // ============================================================
    // Step 1: 共有環境の検出と複製
    // ============================================================
    const sharedEnvRows = db.prepare(`
      SELECT environment_id, count(*) as cnt
      FROM Project
      WHERE environment_id IS NOT NULL
      GROUP BY environment_id
      HAVING count(*) > 1
    `).all() as { environment_id: string; cnt: number }[];

    for (const shared of sharedEnvRows) {
      const projectsUsingEnv = db.prepare(
        'SELECT * FROM Project WHERE environment_id = ?'
      ).all(shared.environment_id) as ProjectRow[];

      const originalEnv = db.prepare(
        'SELECT * FROM ExecutionEnvironment WHERE id = ?'
      ).get(shared.environment_id) as EnvRow | undefined;

      if (!originalEnv) {
        console.warn(`[WARN] 環境 ${shared.environment_id} が見つかりません。スキップします。`);
        continue;
      }

      let isFirst = true;
      for (const project of projectsUsingEnv) {
        if (isFirst) {
          // 最初のプロジェクトは元の環境をそのまま使用（project_id だけ設定）
          // ただし、既に project_id が設定済みの場合はスキップ（べき等性）
          const currentEnv = db.prepare(
            'SELECT project_id FROM ExecutionEnvironment WHERE id = ?'
          ).get(shared.environment_id) as { project_id: string | null };

          if (!currentEnv.project_id) {
            db.prepare(
              'UPDATE ExecutionEnvironment SET project_id = ? WHERE id = ?'
            ).run(project.id, shared.environment_id);
          }
          isFirst = false;
          continue;
        }

        // 残りのプロジェクトは環境を複製
        // べき等性: 既に当該プロジェクトの環境がある（project.environment_id が変更済み）かチェック
        const currentProjectEnv = db.prepare(
          'SELECT project_id FROM ExecutionEnvironment WHERE id = ?'
        ).get(project.environment_id) as { project_id: string | null } | undefined;

        if (currentProjectEnv && currentProjectEnv.project_id === project.id) {
          // 既に当該プロジェクト用の環境が設定済み → スキップ
          continue;
        }

        const newEnvId = generateUUID();
        db.prepare(`
          INSERT INTO ExecutionEnvironment (id, name, type, description, config, auth_dir_path, project_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newEnvId,
          originalEnv.name,
          originalEnv.type,
          originalEnv.description,
          originalEnv.config,
          null, // auth_dir_path は後でコピー（トランザクション外）
          project.id,
          Date.now(),
          Date.now(),
        );

        // projects.environment_id を新しい環境に更新
        db.prepare(
          'UPDATE Project SET environment_id = ? WHERE id = ?'
        ).run(newEnvId, project.id);

        // NetworkFilter を複製
        cloneNetworkFilter(db, shared.environment_id, newEnvId);
      }
    }

    // ============================================================
    // Step 2: 環境未設定プロジェクトへのデフォルト DOCKER 環境作成
    // ============================================================
    const nullEnvProjects = db.prepare(
      'SELECT * FROM Project WHERE environment_id IS NULL'
    ).all() as ProjectRow[];

    for (const project of nullEnvProjects) {
      const newEnvId = generateUUID();
      const defaultConfig = JSON.stringify({
        imageName: 'ghcr.io/windschord/claude-work-sandbox',
        imageTag: 'latest',
      });

      db.prepare(`
        INSERT INTO ExecutionEnvironment (id, name, type, config, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        newEnvId,
        `${project.name} 環境`,
        'DOCKER',
        defaultConfig,
        project.id,
        Date.now(),
        Date.now(),
      );

      db.prepare(
        'UPDATE Project SET environment_id = ? WHERE id = ?'
      ).run(newEnvId, project.id);
    }

    // ============================================================
    // Step 3: 単独プロジェクトが使用している環境の project_id 設定
    // ============================================================
    const singleEnvRows = db.prepare(`
      SELECT p.id as project_id, p.environment_id
      FROM Project p
      WHERE p.environment_id IS NOT NULL
    `).all() as { project_id: string; environment_id: string }[];

    for (const row of singleEnvRows) {
      const env = db.prepare(
        'SELECT project_id FROM ExecutionEnvironment WHERE id = ?'
      ).get(row.environment_id) as { project_id: string | null } | undefined;

      if (env && !env.project_id) {
        db.prepare(
          'UPDATE ExecutionEnvironment SET project_id = ? WHERE id = ?'
        ).run(row.project_id, row.environment_id);
      }
    }

    // ============================================================
    // Step 4: 整合性チェック
    // ============================================================
    const nullProjectIdEnvs = db.prepare(`
      SELECT count(*) as c FROM ExecutionEnvironment WHERE project_id IS NULL
    `).get() as { c: number };

    if (nullProjectIdEnvs.c > 0) {
      throw new Error(
        `マイグレーション後に project_id が null の環境が ${nullProjectIdEnvs.c} 件残っています。`
      );
    }

    const nullEnvProjectsAfter = db.prepare(`
      SELECT count(*) as c FROM Project WHERE environment_id IS NULL
    `).get() as { c: number };

    if (nullEnvProjectsAfter.c > 0) {
      throw new Error(
        `マイグレーション後に environment_id が null のプロジェクトが ${nullEnvProjectsAfter.c} 件残っています。`
      );
    }
  })();

  // ============================================================
  // Step 5: auth_dir_path のコピー（トランザクション外・ベストエフォート）
  // ============================================================
  if (environmentsDir) {
    const envsWithAuthDir = db.prepare(
      'SELECT * FROM ExecutionEnvironment WHERE auth_dir_path IS NOT NULL'
    ).all() as EnvRow[];

    for (const env of envsWithAuthDir) {
      // 複製元の環境IDを持つ環境を検索
      // （複製された環境はauth_dir_pathがnullのため、既にコピー済みでない場合のみ）
      const clonedEnvs = db.prepare(
        'SELECT * FROM ExecutionEnvironment WHERE project_id IS NOT NULL AND auth_dir_path IS NULL'
      ).all() as EnvRow[];

      for (const clonedEnv of clonedEnvs) {
        await cloneAuthDir(db, env, clonedEnv.id, environmentsDir);
      }
    }
  }

  console.log('マイグレーション完了');
}

// スクリプトとして直接実行された場合のみメイン処理を実行
if (process.argv[1] && process.argv[1].includes('migrate-env-project-one-to-one')) {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? './data/test.db';
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  let environmentsDir: string | null = null;
  try {
    const { getEnvironmentsDir } = await import('../src/lib/data-dir.js');
    environmentsDir = getEnvironmentsDir();
  } catch {
    console.warn('[WARN] getEnvironmentsDir の取得に失敗しました。auth_dir_path のコピーをスキップします。');
  }

  runMigration(db, environmentsDir)
    .then(() => {
      console.log('マイグレーションが正常に完了しました。');
      db.close();
    })
    .catch((err) => {
      console.error('マイグレーション中にエラーが発生しました:', err);
      db.close();
      process.exit(1);
    });
}
