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

    it('dataBytesがちょうどmaxSizeと等しい場合、チャンクが1つに置き換わる', () => {
      const smallBuffer = new ScrollbackBuffer(5); // 5 bytes
      smallBuffer.append('s1', 'ab'); // 2 bytes
      // ちょうどmaxSize(5)のデータを追加 -> >=条件で切り出しパスに入る
      smallBuffer.append('s1', 'cdefg'); // 5 bytes == maxSize
      const result = smallBuffer.getBuffer('s1');
      // 既存の'ab'は消えて'cdefg'のみ残る
      expect(result).toBe('cdefg');
      expect(smallBuffer.getByteSize('s1')).toBe(5);
    });

    it('dataBytesがmaxSize-1の場合は通常のappendパスを通る', () => {
      const smallBuffer = new ScrollbackBuffer(5);
      smallBuffer.append('s1', 'ab'); // 2 bytes
      smallBuffer.append('s1', 'cde'); // 3 bytes, total=5, not >= maxSize since 3<5
      const result = smallBuffer.getBuffer('s1');
      expect(result).toBe('abcde');
      expect(smallBuffer.getByteSize('s1')).toBe(5);
    });

    it('マルチバイト文字の境界でUTF-8文字の途中で分断しない', () => {
      // UTF-8で3バイト文字（日本語）を含む巨大データ
      const smallBuffer = new ScrollbackBuffer(6); // 6 bytes = 2文字分
      // 'あいうえ' = 12 bytes, maxSize=6なので末尾6バイト= 'うえ'
      smallBuffer.append('s1', 'あいうえ');
      const result = smallBuffer.getBuffer('s1');
      expect(result).toBe('うえ');
      expect(smallBuffer.getByteSize('s1')).toBe(6);
    });

    it('マルチバイト文字の途中で切断される場合、次の文字境界まで進める', () => {
      // 7バイトの場合: 12-7=5がstart, 'う'は[6,7,8]なので5は'い'の3バイト目(継続バイト)
      // 継続バイトをスキップして'う'の先頭(6)まで進む
      const smallBuffer = new ScrollbackBuffer(7);
      smallBuffer.append('s1', 'あいうえ'); // 12 bytes
      const result = smallBuffer.getBuffer('s1');
      // 7バイトでは2文字+1バイト余りなので、文字境界に合わせて'うえ'(6バイト)になる
      expect(result).toBe('うえ');
      expect(smallBuffer.getByteSize('s1')).toBe(6);
    });

    it('先頭チャンク削除でサイズ制限内に収まる（最低1チャンクは残る）', () => {
      const smallBuffer = new ScrollbackBuffer(10);
      smallBuffer.append('s1', 'aaaa'); // 4 bytes
      smallBuffer.append('s1', 'bbbb'); // 4 bytes = 8 total
      smallBuffer.append('s1', 'cccccc'); // 6 bytes = 14 total, need trim
      const result = smallBuffer.getBuffer('s1');
      // 先頭チャンク'aaaa'が削除される → 10バイト以内
      expect(Buffer.byteLength(result!, 'utf8')).toBeLessThanOrEqual(10);
      expect(result).toContain('cccccc');
    });

    it('最後の1チャンクがmaxSizeを超えても削除されない（chunks.length > 1 ガード）', () => {
      // maxSize=10のバッファで、3チャンク追加後に小さいチャンクでオーバーフロー
      // 最後のチャンクがmaxSize未満なので巨大データパスに入らない
      const smallBuffer = new ScrollbackBuffer(10);
      smallBuffer.append('s1', 'aaaa'); // 4 bytes
      smallBuffer.append('s1', 'bbbb'); // 4 bytes, total=8
      // 6バイト追加 → total=14 > 10
      // whileで'aaaa'(4)削除→total=10, len=2>1 → まだbyteSize>maxSizeではないので停止
      // もう1回: 'bbbb'削除の前にbyteSize(10)>maxSize(10)がfalseなので停止
      smallBuffer.append('s1', 'cccccc'); // 6 bytes
      const result = smallBuffer.getBuffer('s1');
      expect(result).toContain('cccccc');
      expect(smallBuffer.getByteSize('s1')).toBeLessThanOrEqual(10);
    });

    it('チャンク削除のwhile文はchunks.length>1で停止し、最後のチャンクは残る', () => {
      // maxSize=2で2チャンク。先頭削除後もbyteSize(3)>maxSize(2)だがlen===1で停止
      const smallBuffer = new ScrollbackBuffer(2);
      smallBuffer.append('s1', 'a'); // 1 byte
      // 2バイト目のデータ: 'bcd'(3bytes) は >= maxSize(2) なので巨大データパスに入ってしまう
      // 代わにmaxSizeを大きくしてチャンク追加パスを使う
      const sb2 = new ScrollbackBuffer(4);
      sb2.append('s1', 'aa'); // 2 bytes
      sb2.append('s1', 'bbb'); // 3 bytes, total=5 > 4
      // whileで'aa'(2)削除 → total=3, len=1 → byteSize(3)<=maxSize(4) → 停止
      expect(sb2.getBuffer('s1')).toBe('bbb');
      expect(sb2.getByteSize('s1')).toBe(3);

      // length>1 vs >=1 を殺す: 先頭チャンク削除後、1チャンクだけ残り
      // そのbyteSizeがmaxSizeを超えている場合でも消えないこと
      const sb3 = new ScrollbackBuffer(5);
      sb3.append('s1', 'ab'); // 2 bytes
      sb3.append('s1', 'cdef'); // 4 bytes (<5), total=6 > 5
      // while: 'ab'(2)削除→total=4, len=1→ >1 false→停止（>=1ならさらに削除→空→null）
      const result3 = sb3.getBuffer('s1');
      expect(result3).toBe('cdef');
      expect(sb3.getByteSize('s1')).toBe(4);
    });

    it('getBufferがチャンクが空の場合nullを返す', () => {
      const smallBuffer = new ScrollbackBuffer(10);
      // appendせずにgetBufferを呼ぶ
      expect(smallBuffer.getBuffer('s1')).toBeNull();
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

    it('100チャンク以下では結合されない（個別チャンクが維持される）', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      for (let i = 0; i < 50; i++) {
        compactBuffer.append('s1', `c${i} `);
      }
      const result = compactBuffer.getBuffer('s1');
      expect(result).toContain('c0');
      expect(result).toContain('c49');
    });

    it('ちょうど101チャンクで結合が発生する', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      for (let i = 0; i < 101; i++) {
        compactBuffer.append('s1', `d${i} `);
      }
      const result = compactBuffer.getBuffer('s1');
      // 結合後もデータが正しい
      expect(result).toContain('d0');
      expect(result).toContain('d100');
      // byteSizeが正しい
      expect(compactBuffer.getByteSize('s1')).toBe(Buffer.byteLength(result!, 'utf8'));
    });

    it('結合後のjoinが空文字セパレータで行われる', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      for (let i = 0; i < 105; i++) {
        compactBuffer.append('s1', 'x');
      }
      const result = compactBuffer.getBuffer('s1');
      // セパレータなしで結合 → 105文字の'x'が連続する
      expect(result).toBe('x'.repeat(105));
    });

    it('コンパクション後もbyteSizeが正確に維持される', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      // マルチバイト文字で101チャンク以上追加
      for (let i = 0; i < 105; i++) {
        compactBuffer.append('s1', 'あ'); // 3 bytes each
      }
      const result = compactBuffer.getBuffer('s1');
      expect(compactBuffer.getByteSize('s1')).toBe(105 * 3);
      expect(Buffer.byteLength(result!, 'utf8')).toBe(105 * 3);
    });

    it('コンパクション後に追加のappendが正常に動作する', () => {
      const compactBuffer = new ScrollbackBuffer(100 * 1024);
      for (let i = 0; i < 105; i++) {
        compactBuffer.append('s1', 'a');
      }
      // コンパクション後に追加
      compactBuffer.append('s1', 'b');
      const result = compactBuffer.getBuffer('s1');
      expect(result).toBe('a'.repeat(105) + 'b');
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

    it('未設定の場合はデフォルト(100KB)で、100KBを超えるデータは切り捨てられる', async () => {
      delete process.env.SCROLLBACK_BUFFER_SIZE;
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      // 100KB + 1000バイトのデータを追加
      const defaultMax = 100 * 1024;
      sb.append('test-overflow', 'a'.repeat(defaultMax + 1000));
      expect(sb.getByteSize('test-overflow')).toBeLessThanOrEqual(defaultMax);
      expect(sb.getByteSize('test-overflow')).toBe(defaultMax);
    });

    it('環境変数が設定されていればデフォルトではなくその値が使われる', async () => {
      process.env.SCROLLBACK_BUFFER_SIZE = '512';
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      sb.append('test', 'a'.repeat(1000));
      // 512バイトに制限されているはず
      expect(sb.getByteSize('test')).toBeLessThanOrEqual(512);
      expect(sb.getByteSize('test')).toBe(512);
    });

    it('負の値はデフォルトにフォールバック', async () => {
      process.env.SCROLLBACK_BUFFER_SIZE = '-100';
      const mod = await import('../scrollback-buffer');
      const sb = mod.scrollbackBuffer;
      sb.append('test', 'a'.repeat(50000));
      expect(sb.getByteSize('test')).toBe(50000);
    });
  });
});
