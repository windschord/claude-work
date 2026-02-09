import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScrollbackBuffer } from '../scrollback-buffer';

describe('ScrollbackBuffer', () => {
  let buffer: ScrollbackBuffer;

  beforeEach(() => {
    buffer = new ScrollbackBuffer(1024); // 1KB for testing
  });

  describe('append / getBuffer', () => {
    it('空バッファにデータを追加できる', () => {
      buffer.append('s1', 'hello');
      expect(buffer.getBuffer('s1')).toBe('hello');
    });

    it('複数回のappendでデータが蓄積される', () => {
      buffer.append('s1', 'hello ');
      buffer.append('s1', 'world');
      expect(buffer.getBuffer('s1')).toBe('hello world');
    });

    it('異なるセッションは独立している', () => {
      buffer.append('s1', 'session1');
      buffer.append('s2', 'session2');
      expect(buffer.getBuffer('s1')).toBe('session1');
      expect(buffer.getBuffer('s2')).toBe('session2');
    });

    it('存在しないセッションはnullを返す', () => {
      expect(buffer.getBuffer('nonexistent')).toBeNull();
    });
  });

  describe('byte-based size limit', () => {
    it('maxSizeを超えると先頭データが切り捨てられる', () => {
      const smallBuffer = new ScrollbackBuffer(10); // 10 bytes
      smallBuffer.append('s1', 'abcde'); // 5 bytes
      smallBuffer.append('s1', 'fghij'); // 5 bytes = 10 bytes total
      expect(smallBuffer.getBuffer('s1')).toBe('abcdefghij');

      smallBuffer.append('s1', 'klmno'); // 5 bytes → total 15, trim to 10
      const result = smallBuffer.getBuffer('s1');
      // 先頭チャンクが削除され、残りが10バイト以内
      expect(Buffer.byteLength(result!, 'utf8')).toBeLessThanOrEqual(10);
      expect(result).toContain('klmno');
    });

    it('マルチバイト文字でもバイト数で制限される', () => {
      const smallBuffer = new ScrollbackBuffer(20); // 20 bytes
      // 日本語1文字 = 3バイト(UTF-8)
      smallBuffer.append('s1', 'あいう'); // 9 bytes
      smallBuffer.append('s1', 'えおか'); // 9 bytes = 18 bytes total
      expect(smallBuffer.getBuffer('s1')).toBe('あいうえおか');
      expect(smallBuffer.getByteSize('s1')).toBe(18);

      smallBuffer.append('s1', 'きくけ'); // 9 bytes → total 27, trim
      expect(smallBuffer.getByteSize('s1')).toBeLessThanOrEqual(20);
    });

    it('単一の巨大データはmaxSizeの末尾分だけ保持される', () => {
      const smallBuffer = new ScrollbackBuffer(5); // 5 bytes
      smallBuffer.append('s1', 'abcdefghij'); // 10 bytes > 5
      const result = smallBuffer.getBuffer('s1');
      expect(result).toBe('fghij');
      expect(smallBuffer.getByteSize('s1')).toBe(5);
    });
  });

  describe('clear', () => {
    it('バッファをクリアできる', () => {
      buffer.append('s1', 'data');
      buffer.clear('s1');
      expect(buffer.getBuffer('s1')).toBeNull();
      expect(buffer.has('s1')).toBe(false);
    });

    it('他のセッションに影響しない', () => {
      buffer.append('s1', 'data1');
      buffer.append('s2', 'data2');
      buffer.clear('s1');
      expect(buffer.getBuffer('s1')).toBeNull();
      expect(buffer.getBuffer('s2')).toBe('data2');
    });
  });

  describe('has', () => {
    it('存在するセッションはtrueを返す', () => {
      buffer.append('s1', 'data');
      expect(buffer.has('s1')).toBe(true);
    });

    it('存在しないセッションはfalseを返す', () => {
      expect(buffer.has('nonexistent')).toBe(false);
    });
  });

  describe('getByteSize', () => {
    it('バッファサイズをバイト数で返す', () => {
      buffer.append('s1', 'hello'); // 5 bytes (ASCII)
      expect(buffer.getByteSize('s1')).toBe(5);
    });

    it('マルチバイト文字のバイト数を正確に返す', () => {
      buffer.append('s1', 'あ'); // 3 bytes in UTF-8
      expect(buffer.getByteSize('s1')).toBe(3);
    });

    it('存在しないセッションは0を返す', () => {
      expect(buffer.getByteSize('nonexistent')).toBe(0);
    });
  });

  describe('chunk compaction', () => {
    it('100チャンクを超えると結合される', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      for (let i = 0; i < 150; i++) {
        compactBuffer.append('s1', `chunk${i} `);
      }
      const result = compactBuffer.getBuffer('s1');
      expect(result).toContain('chunk0');
      expect(result).toContain('chunk149');
    });
  });

  describe('SCROLLBACK_BUFFER_SIZE env var', () => {
    const originalEnv = process.env.SCROLLBACK_BUFFER_SIZE;

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.SCROLLBACK_BUFFER_SIZE;
      } else {
        process.env.SCROLLBACK_BUFFER_SIZE = originalEnv;
      }
    });

    it('環境変数でバッファサイズを変更できる', async () => {
      process.env.SCROLLBACK_BUFFER_SIZE = '2048';
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      // 2048バイト以上のデータを追加してサイズ制限を確認
      sb.append('test', 'a'.repeat(3000));
      expect(sb.getByteSize('test')).toBeLessThanOrEqual(2048);
    });

    it('不正な値の場合はデフォルト(100KB)にフォールバック', async () => {
      process.env.SCROLLBACK_BUFFER_SIZE = 'invalid';
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      // デフォルトの100KBを超えないデータが保持される
      sb.append('test', 'a'.repeat(50000));
      expect(sb.getByteSize('test')).toBe(50000);
    });

    it('0以下の値はデフォルトにフォールバック', async () => {
      process.env.SCROLLBACK_BUFFER_SIZE = '0';
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      sb.append('test', 'a'.repeat(50000));
      expect(sb.getByteSize('test')).toBe(50000);
    });

    it('未設定の場合はデフォルト(100KB)', async () => {
      delete process.env.SCROLLBACK_BUFFER_SIZE;
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      sb.append('test', 'a'.repeat(50000));
      expect(sb.getByteSize('test')).toBe(50000);
    });
  });
});
