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

    it('project_id は nullable である', () => {
      const input: NewExecutionEnvironment = {
        name: 'test',
        type: 'DOCKER',
        config: '{}',
        // project_id を省略可能
      };
      expect(input.project_id).toBeUndefined();
    });
  });
});
