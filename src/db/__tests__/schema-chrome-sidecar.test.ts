import { describe, it, expect } from 'vitest';
import { sessions } from '../schema';

describe('Chrome Sidecar DBスキーマ', () => {
  describe('スキーマ定義の検証', () => {
    it('sessions テーブルに chrome_container_id カラムが存在すること', () => {
      expect(sessions.chrome_container_id).toBeDefined();
      expect(sessions.chrome_container_id.name).toBe('chrome_container_id');
    });

    it('sessions テーブルに chrome_debug_port カラムが存在すること', () => {
      expect(sessions.chrome_debug_port).toBeDefined();
      expect(sessions.chrome_debug_port.name).toBe('chrome_debug_port');
    });
  });

  describe('カラム定義の検証', () => {
    it('chrome_container_id がNULL許可であること', () => {
      // Drizzle ORMでNULL許可=notNullが設定されていない
      expect(sessions.chrome_container_id.notNull).toBe(false);
    });

    it('chrome_debug_port がNULL許可であること', () => {
      expect(sessions.chrome_debug_port.notNull).toBe(false);
    });

    it('chrome_container_id が text 型であること', () => {
      expect(sessions.chrome_container_id.columnType).toBe('SQLiteText');
    });

    it('chrome_debug_port が integer 型であること', () => {
      expect(sessions.chrome_debug_port.columnType).toBe('SQLiteInteger');
    });
  });
});
