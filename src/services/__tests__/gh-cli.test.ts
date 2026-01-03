import { describe, it, expect } from 'vitest';
import { extractPRNumber } from '../gh-cli';

describe('gh-cli service', () => {
  describe('extractPRNumber', () => {
    it('GitHub PR URLからPR番号を抽出する', () => {
      expect(extractPRNumber('https://github.com/owner/repo/pull/123')).toBe(123);
    });

    it('末尾にスラッシュがあってもPR番号を抽出する', () => {
      expect(extractPRNumber('https://github.com/owner/repo/pull/456/')).toBe(456);
    });

    it('PR番号がURLに含まれない場合はnullを返す', () => {
      expect(extractPRNumber('https://github.com/owner/repo')).toBeNull();
    });

    it('空文字の場合はnullを返す', () => {
      expect(extractPRNumber('')).toBeNull();
    });

    it('不正なURLの場合はnullを返す', () => {
      expect(extractPRNumber('not-a-url')).toBeNull();
    });
  });
});
