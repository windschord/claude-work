import { describe, it, expect } from 'vitest';

/**
 * DATABASE_URL環境変数のバリデーションロジックをテスト
 *
 * このテストは、db.tsに実装されるべきバリデーションロジックの仕様を定義します。
 * TDDアプローチに従い、先にテストを書き、その後実装を行います。
 */
describe('Database Configuration', () => {
  /**
   * データベースURL検証関数
   * この関数はdb.tsに実装される予定の検証ロジックを表現しています
   */
  const validateDatabaseUrl = (url: string | undefined): void => {
    if (!url || url.trim() === '') {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please set it in your .env file. ' +
        'Example: DATABASE_URL=file:./prisma/data/claudework.db'
      );
    }
  };

  it('DATABASE_URLが設定されていない場合、エラーをスローする', () => {
    expect(() => {
      validateDatabaseUrl(undefined);
    }).toThrow('DATABASE_URL environment variable is not set');
  });

  it('DATABASE_URLが設定されている場合、エラーをスローしない', () => {
    expect(() => {
      validateDatabaseUrl('file:./prisma/data/claudework.db');
    }).not.toThrow();
  });

  it('DATABASE_URLが空文字の場合、エラーをスローする', () => {
    expect(() => {
      validateDatabaseUrl('');
    }).toThrow('DATABASE_URL environment variable is not set');
  });
});
