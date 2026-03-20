import { describe, it, expect } from 'vitest';
import { parseDotenv } from '../dotenv-parser';

describe('parseDotenv', () => {
  describe('基本的なパース', () => {
    it('KEY=VALUE 形式をパースする', () => {
      const result = parseDotenv('DATABASE_URL=postgresql://localhost:5432/mydb');
      expect(result.variables).toEqual({ DATABASE_URL: 'postgresql://localhost:5432/mydb' });
      expect(result.errors).toHaveLength(0);
    });

    it('複数行をパースする', () => {
      const content = 'KEY1=value1\nKEY2=value2\nKEY3=value3';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3',
      });
    });

    it('値に = を含む行は最初の = で分割する', () => {
      const result = parseDotenv('CONNECTION=host=localhost;port=5432');
      expect(result.variables).toEqual({ CONNECTION: 'host=localhost;port=5432' });
    });
  });

  describe('クォート処理', () => {
    it('ダブルクォートの値のクォートを除去する', () => {
      const result = parseDotenv('KEY="hello world"');
      expect(result.variables).toEqual({ KEY: 'hello world' });
    });

    it('シングルクォートの値のクォートを除去する', () => {
      const result = parseDotenv("KEY='hello world'");
      expect(result.variables).toEqual({ KEY: 'hello world' });
    });

    it('クォート内の # はコメントとして扱わない', () => {
      const result = parseDotenv('KEY="value # with hash"');
      expect(result.variables).toEqual({ KEY: 'value # with hash' });
    });
  });

  describe('コメントと空行', () => {
    it('# で始まる行をスキップする', () => {
      const content = '# comment\nKEY=value';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('空行をスキップする', () => {
      const content = 'KEY1=value1\n\n\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    it('インラインコメントを除去する（クォートなし）', () => {
      const result = parseDotenv('KEY=value # this is a comment');
      expect(result.variables).toEqual({ KEY: 'value' });
    });
  });

  describe('export プレフィックス', () => {
    it('export KEY=VALUE 形式をパースする', () => {
      const result = parseDotenv('export API_KEY=sk-12345');
      expect(result.variables).toEqual({ API_KEY: 'sk-12345' });
    });
  });

  describe('空白の処理', () => {
    it('キーの前後の空白をトリムする', () => {
      const result = parseDotenv('  KEY  =value');
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('値の前後の空白をトリムする', () => {
      const result = parseDotenv('KEY=  value  ');
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('先頭空白のあるコメント行をスキップする', () => {
      const result = parseDotenv('  # comment\nKEY=value');
      expect(result.variables).toEqual({ KEY: 'value' });
    });
  });

  describe('エラーハンドリング', () => {
    it('= のない非空行をエラーとして報告する', () => {
      const result = parseDotenv('INVALID_LINE\nKEY=value');
      expect(result.variables).toEqual({ KEY: 'value' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Line 1');
    });

    it('空キーをエラーとして報告する', () => {
      const result = parseDotenv('=value');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('キーが空');
    });
  });

  describe('Windows改行コード', () => {
    it('\\r\\n で区切られた行をパースする', () => {
      const content = 'KEY1=value1\r\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });
  });

  describe('複合テスト', () => {
    it('一般的な.envファイルを正しくパースする', () => {
      const content = [
        '# Database settings',
        'DATABASE_URL=postgresql://localhost:5432/mydb',
        '',
        '# API Keys',
        'export API_KEY="sk-12345"',
        "SECRET='my-secret-value'",
        '',
        'DEBUG=true # enable debug mode',
        'EMPTY_VALUE=',
      ].join('\n');

      const result = parseDotenv(content);
      expect(result.variables).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'sk-12345',
        SECRET: 'my-secret-value',
        DEBUG: 'true',
        EMPTY_VALUE: '',
      });
      expect(result.errors).toHaveLength(0);
    });
  });
});
