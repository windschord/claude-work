import { describe, it, expect } from 'vitest';
import { parseRunScripts, serializeRunScripts, type RunScript } from '../run-scripts';

describe('run-scripts', () => {
  describe('parseRunScripts', () => {
    it('should return empty array for null', () => {
      expect(parseRunScripts(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(parseRunScripts(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseRunScripts('')).toEqual([]);
    });

    it('should parse valid JSON array', () => {
      const scripts: RunScript[] = [
        { name: 'test', command: 'npm test' },
        { name: 'build', command: 'npm run build' },
      ];
      const result = parseRunScripts(JSON.stringify(scripts));
      expect(result).toEqual(scripts);
    });

    it('should return empty array for non-array JSON', () => {
      expect(parseRunScripts(JSON.stringify({ name: 'test' }))).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseRunScripts('not valid json{')).toEqual([]);
    });

    it('should return empty array for JSON string (not array)', () => {
      expect(parseRunScripts(JSON.stringify('hello'))).toEqual([]);
    });

    it('should return empty array for JSON number', () => {
      expect(parseRunScripts(JSON.stringify(42))).toEqual([]);
    });

    it('should parse single-element array', () => {
      const scripts = [{ name: 'lint', command: 'eslint .' }];
      expect(parseRunScripts(JSON.stringify(scripts))).toEqual(scripts);
    });

    it('should parse empty array', () => {
      expect(parseRunScripts('[]')).toEqual([]);
    });
  });

  describe('serializeRunScripts', () => {
    it('should serialize scripts array to JSON string', () => {
      const scripts: RunScript[] = [
        { name: 'test', command: 'npm test' },
      ];
      expect(serializeRunScripts(scripts)).toBe(JSON.stringify(scripts));
    });

    it('should return empty array JSON for null', () => {
      expect(serializeRunScripts(null)).toBe('[]');
    });

    it('should return empty array JSON for undefined', () => {
      expect(serializeRunScripts(undefined)).toBe('[]');
    });

    it('should return empty array JSON for non-array value', () => {
      // @ts-expect-error - intentionally passing wrong type for testing
      expect(serializeRunScripts('not an array')).toBe('[]');
    });

    it('should serialize empty array', () => {
      expect(serializeRunScripts([])).toBe('[]');
    });

    it('should serialize multiple scripts', () => {
      const scripts: RunScript[] = [
        { name: 'a', command: 'cmd-a' },
        { name: 'b', command: 'cmd-b' },
      ];
      const result = serializeRunScripts(scripts);
      expect(JSON.parse(result)).toEqual(scripts);
    });
  });
});
