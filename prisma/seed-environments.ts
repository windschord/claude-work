/**
 * TASK-EE-017: 既存docker_modeセッションのマイグレーションスクリプト
 *
 * 目的:
 * - デフォルトHOST環境を作成
 * - docker_mode=trueの既存セッション用にDocker環境を作成
 * - 該当セッションのenvironment_idを設定
 *
 * 冪等性:
 * - upsertを使用して複数回実行しても問題なし
 * - 既にマイグレーション済みのセッションはスキップ
 */

/**
 * TASK-EE-017: 既存docker_modeセッションのマイグレーションスクリプト
 *
 * 注意: このスクリプトは本番データベースに対して実行することを想定しており、
 * DATABASE_URL環境変数の設定が必須です。CI環境のフォールバック値は使用しません。
 * 実行例: DATABASE_URL=file:../data/claudework.db npm run db:migrate-environments
 */

import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';

// DATABASE_URL環境変数の検証
// prisma.config.ts とは異なり、このスクリプトは本番データベースへのマイグレーション用のため
// フォールバック値を使用せず、明示的な設定を必須とする
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error(
    'DATABASE_URL environment variable is not set.\n' +
    'This script requires an explicit database path for migration.\n' +
    'Example: DATABASE_URL=file:../data/claudework.db npm run db:migrate-environments'
  );
}

// seed スクリプト用のスタンドアロン PrismaClient インスタンス
// 注: src/lib/db.ts のシングルトンを使用できないのは、
// このスクリプトが ts-node で直接実行されるため
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function migrateToEnvironments(): Promise<void> {
  console.log('=== Environment Migration Start ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // 1. デフォルトHOST環境を作成（upsert）
  console.log('[Step 1] Ensuring default HOST environment...');
  const hostEnv = await prisma.executionEnvironment.upsert({
    where: { id: 'host-default' },
    create: {
      id: 'host-default',
      name: 'Local Host',
      type: 'HOST',
      description: 'ローカル環境で直接実行',
      config: '{}',
      is_default: true,
    },
    update: {}, // 既存ならそのまま
  });
  console.log(`  - Default HOST environment ensured: ${hostEnv.id}`);
  console.log(`    Name: ${hostEnv.name}`);
  console.log(`    Type: ${hostEnv.type}`);
  console.log(`    Is Default: ${hostEnv.is_default}`);
  console.log('');

  // 2. docker_mode=trueかつenvironment_id未設定のセッションを検索
  console.log('[Step 2] Finding docker_mode sessions to migrate...');
  const dockerSessions = await prisma.session.findMany({
    where: {
      docker_mode: true,
      environment_id: null, // まだマイグレーションされていないもの
    },
    select: {
      id: true,
      name: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(`  - Found ${dockerSessions.length} session(s) to migrate`);

  if (dockerSessions.length > 0) {
    // セッション一覧を表示
    console.log('  - Sessions to migrate:');
    for (const session of dockerSessions) {
      console.log(`    * ${session.name} (Project: ${session.project.name}, ID: ${session.id})`);
    }
    console.log('');

    // 3. レガシーDocker環境を作成
    console.log('[Step 3] Ensuring legacy Docker environment...');
    const dockerEnv = await prisma.executionEnvironment.upsert({
      where: { id: 'docker-legacy' },
      create: {
        id: 'docker-legacy',
        name: 'Docker (Legacy)',
        type: 'DOCKER',
        description: '既存のDockerセッション用環境（ホスト認証共有）',
        config: JSON.stringify({
          imageName: 'claude-code-sandboxed',
          imageTag: 'latest',
        }),
        is_default: false,
        // 注: レガシー環境はauth_dir_pathなし（ホスト認証共有のため）
      },
      update: {},
    });
    console.log(`  - Legacy Docker environment ensured: ${dockerEnv.id}`);
    console.log(`    Name: ${dockerEnv.name}`);
    console.log(`    Type: ${dockerEnv.type}`);
    console.log(`    Config: ${dockerEnv.config}`);
    console.log('');

    // 4. 該当セッションを更新
    console.log('[Step 4] Updating sessions with environment_id...');
    const updateResult = await prisma.session.updateMany({
      where: {
        docker_mode: true,
        environment_id: null,
      },
      data: { environment_id: dockerEnv.id },
    });
    console.log(`  - Migrated ${updateResult.count} session(s)`);
  } else {
    console.log('  - No sessions to migrate (all docker_mode sessions already have environment_id)');
  }

  console.log('');

  // 5. 最終状態を表示
  console.log('[Summary] Current environment status:');
  const allEnvs = await prisma.executionEnvironment.findMany({
    include: {
      _count: {
        select: { sessions: true },
      },
    },
  });

  for (const env of allEnvs) {
    console.log(`  - ${env.name} (${env.id})`);
    console.log(`    Type: ${env.type}`);
    console.log(`    Sessions: ${env._count.sessions}`);
    console.log(`    Default: ${env.is_default}`);
  }

  console.log('');
  console.log('=== Environment Migration Complete ===');
}

migrateToEnvironments()
  .catch((e) => {
    console.error('');
    console.error('=== Migration Failed ===');
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
