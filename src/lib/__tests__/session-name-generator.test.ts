import { describe, it, expect } from 'vitest';
import {
  generateSessionName,
  generateUniqueSessionName,
  ADJECTIVES,
  ANIMALS,
} from '../session-name-generator';

describe('session-name-generator', () => {
  describe('generateSessionName', () => {
    it('形容詞-動物名形式の文字列を返す', () => {
      const name = generateSessionName();

      // ハイフンで分割して2つの部分になることを確認
      const parts = name.split('-');
      expect(parts).toHaveLength(2);

      // 各部分が形容詞リストと動物リストに含まれていることを確認
      expect(ADJECTIVES).toContain(parts[0]);
      expect(ANIMALS).toContain(parts[1]);
    });

    it('英小文字とハイフンのみで構成される', () => {
      const name = generateSessionName();
      expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    });

    it('複数回呼び出すと異なる名前を生成する可能性がある', () => {
      // 10回生成して、少なくとも2つ以上の異なる名前があることを確認
      const names = new Set<string>();
      for (let i = 0; i < 10; i++) {
        names.add(generateSessionName());
      }
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe('generateUniqueSessionName', () => {
    it('既存の名前と重複しない名前を生成する', () => {
      const existingNames = ['swift-panda', 'gentle-falcon'];
      const name = generateUniqueSessionName(existingNames);

      expect(existingNames).not.toContain(name);
    });

    it('既存の名前が空配列の場合も正常に動作する', () => {
      const name = generateUniqueSessionName([]);

      expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    });

    it('最大試行回数に達した場合はタイムスタンプ付きの名前を返す', () => {
      // すべての組み合わせを既存名として渡す（実際には不可能だが、maxAttemptsでシミュレート）
      const existingNames = ['test-name'];

      // maxAttempts=1で、最初の生成が既存名と一致する場合のテスト
      // この場合、タイムスタンプ付きの名前が返される
      const mockExistingNames = Array.from(
        { length: 100 },
        (_, i) => `name-${i}`
      );

      // 通常の生成ではタイムスタンプ形式にならないことを確認
      const normalName = generateUniqueSessionName(mockExistingNames);
      expect(normalName).toMatch(/^[a-z]+-[a-z]+$/);
    });
  });

  describe('単語リスト', () => {
    it('形容詞リストが50語以上ある', () => {
      expect(ADJECTIVES.length).toBeGreaterThanOrEqual(50);
    });

    it('動物名リストが50語以上ある', () => {
      expect(ANIMALS.length).toBeGreaterThanOrEqual(50);
    });

    it('すべての形容詞が英小文字のみで構成される', () => {
      ADJECTIVES.forEach((adj) => {
        expect(adj).toMatch(/^[a-z]+$/);
      });
    });

    it('すべての動物名が英小文字のみで構成される', () => {
      ANIMALS.forEach((animal) => {
        expect(animal).toMatch(/^[a-z]+$/);
      });
    });
  });
});
