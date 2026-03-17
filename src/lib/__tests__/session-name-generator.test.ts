import { describe, it, expect, vi } from 'vitest';
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

    it('Math.randomの値に応じて異なる要素が選ばれる（* vs / 演算子テスト）', () => {
      // Math.random() * length -> 大きい値 -> リストの後ろの要素
      // Math.random() / length -> 非常に小さい値 -> 常に最初の要素
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      try {
        const name = generateSessionName();
        const parts = name.split('-');
        // 0.99 * 51 = 50.49 -> floor = 50 -> リストの最後の方の要素
        // 0.99 / 51 = 0.019... -> floor = 0 -> 常に最初の要素 ('swift')
        // adjective が 'swift' (最初)ではないことを確認
        expect(parts[0]).not.toBe(ADJECTIVES[0]);
        expect(parts[1]).not.toBe(ANIMALS[0]);
      } finally {
        mockRandom.mockRestore();
      }
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
      // Math.randomをモックして常に0を返すようにする（常に"swift-panda"が生成される）
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);

      try {
        // "swift-panda"を既存名として渡し、maxAttempts=3で全て重複させる
        const existingNames = ['swift-panda'];
        const name = generateUniqueSessionName(existingNames, 3);

        // タイムスタンプ形式の名前が返されることを確認
        expect(name).toMatch(/^session-\d+$/);
      } finally {
        mockRandom.mockRestore();
      }
    });

    it('maxAttempts回のリトライ後にタイムスタンプ名を返す（< vs <= の境界テスト）', () => {
      let callCount = 0;
      const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
        callCount++;
        return 0; // 常に 'swift-panda' を生成
      });

      try {
        const existingNames = ['swift-panda'];
        generateUniqueSessionName(existingNames, 5);
        // maxAttempts=5 の場合、generateSessionName は正確に5回呼ばれる（< だから 0,1,2,3,4）
        // 各呼び出しで Math.random が2回呼ばれる（adjective + animal）
        expect(callCount).toBe(10); // 5 attempts * 2 random calls
      } finally {
        mockRandom.mockRestore();
      }
    });

    it('通常の生成では形容詞-動物名形式が返される', () => {
      // 重複しない既存名を用意
      const mockExistingNames = Array.from(
        { length: 100 },
        (_, i) => `name-${i}`
      );

      // 形容詞-動物名形式が返されることを確認
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
