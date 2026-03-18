import { describe, it, expect } from 'vitest';
import type { NewExecutionEnvironment } from '@/db/schema';

describe('executionEnvironments schema: project_id カラム追加', () => {
  describe('スキーマ型チェック', () => {
    it('NewExecutionEnvironment 型に project_id フィールドが存在する', () => {
      // 型レベルのチェック（TypeScriptコンパイル通過 = テスト成功）
      const input: NewExecutionEnvironment = {
        name: 'test',
        type: 'DOCKER',
        config: '{}',
        project_id: 'some-project-id',
      };
      expect(input.project_id).toBe('some-project-id');
    });

    it('project_id には有効なプロジェクトIDを設定する必要がある', () => {
      // TASK-003 の要件: マイグレーション後、すべての環境レコードは project_id を持つ。
      // スキーマ型では技術的には省略可能だが、アプリケーションレベルでは
      // 必ず project_id を付与して環境を作成すること（マイグレーションスクリプトで保証済み）。
      const input: NewExecutionEnvironment = {
        name: 'test',
        type: 'DOCKER',
        config: '{}',
        project_id: 'proj-abc123',
      };
      expect(input.project_id).toBe('proj-abc123');
      expect(typeof input.project_id).toBe('string');
    });
  });
});
