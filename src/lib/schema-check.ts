import { getTableName, getTableColumns } from 'drizzle-orm';
import * as schema from '@/db/schema';
import Database from 'better-sqlite3';

export interface MissingColumn {
  table: string;
  column: string;
  expectedType: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  missingColumns: MissingColumn[];
  checkedTables: string[];
  timestamp: Date;
}

/**
 * データベーススキーマの整合性を検証する
 *
 * Drizzle ORMのスキーマ定義とSQLiteデータベースの実際のテーブル構造を比較し、
 * 不足しているカラムがあれば詳細情報を返す。
 * 読み取り専用操作のため、データベースは変更しない。
 *
 * @param db - better-sqlite3データベースインスタンス
 * @returns 検証結果オブジェクト
 *
 * @example
 * ```typescript
 * const result = validateSchemaIntegrity(db);
 * if (!result.valid) {
 *   console.error(formatValidationError(result));
 *   process.exit(1);
 * }
 * ```
 */
export function validateSchemaIntegrity(
  db: Database.Database
): SchemaValidationResult {
  const missingColumns: MissingColumn[] = [];
  const checkedTables: string[] = [];

  const tables = [
    schema.projects,
    schema.sessions,
    schema.executionEnvironments,
    schema.messages,
    schema.prompts,
    schema.runScripts,
    schema.githubPats,
  ];

  for (const table of tables) {
    const tableName = getTableName(table);
    checkedTables.push(tableName);

    // 期待されるカラム定義を取得
    const expectedColumns = getTableColumns(table);

    // 実際のカラム一覧をPRAGMAで取得（読み取り専用）
    const actualColumns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string; type: string }>;

    const actualColumnNames = new Set(actualColumns.map((col) => col.name));

    // 不足しているカラムを検出
    for (const [, columnDef] of Object.entries(expectedColumns)) {
      const sqlColumnName = columnDef.name;
      if (!actualColumnNames.has(sqlColumnName)) {
        missingColumns.push({
          table: tableName,
          column: sqlColumnName,
          expectedType: columnDef.dataType,
        });
      }
    }
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    checkedTables,
    timestamp: new Date(),
  };
}

/**
 * スキーマ不一致時のエラーメッセージを生成する
 *
 * @param result - validateSchemaIntegrity()の戻り値
 * @returns エラーメッセージ文字列（整合性OKの場合は空文字列）
 */
export function formatValidationError(result: SchemaValidationResult): string {
  if (result.valid) return '';

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════════╗',
    '║  ❌ データベーススキーマが不整合です                            ║',
    '╚════════════════════════════════════════════════════════════════╝',
    '',
    '不足しているカラム:',
  ];

  // テーブル別にグループ化
  const byTable = new Map<string, MissingColumn[]>();
  for (const col of result.missingColumns) {
    if (!byTable.has(col.table)) byTable.set(col.table, []);
    byTable.get(col.table)!.push(col);
  }

  for (const [table, cols] of byTable) {
    lines.push(`  📋 ${table}:`);
    for (const col of cols) {
      lines.push(`     - ${col.column} (${col.expectedType})`);
    }
  }

  lines.push(
    '',
    '修復方法:',
    '  1. マイグレーションファイルを生成:',
    '     $ npx drizzle-kit generate',
    '',
    '  2. サーバーを再起動（マイグレーションが自動適用されます）:',
    '     $ npm run dev',
    '',
    '  または直接スキーマを同期（開発用）:',
    '     $ npx drizzle-kit push',
    ''
  );

  return lines.join('\n');
}
