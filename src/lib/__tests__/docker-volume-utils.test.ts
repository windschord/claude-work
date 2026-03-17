import { describe, it, expect } from 'vitest';
import { getConfigVolumeNames } from '../docker-volume-utils';

describe('getConfigVolumeNames', () => {
  it('有効なenvironmentIdでVolume名を生成する', () => {
    const result = getConfigVolumeNames('env-123');
    expect(result).toEqual({
      claudeVolume: 'claude-config-claude-env-123',
      configClaudeVolume: 'claude-config-configclaude-env-123',
    });
  });

  it('異なるenvironmentIdで異なるVolume名を返す', () => {
    const result1 = getConfigVolumeNames('aaa');
    const result2 = getConfigVolumeNames('bbb');
    expect(result1.claudeVolume).not.toBe(result2.claudeVolume);
    expect(result1.configClaudeVolume).not.toBe(result2.configClaudeVolume);
  });

  it('空文字列でエラーをスローする', () => {
    expect(() => getConfigVolumeNames('')).toThrow('environmentId is required');
  });

  it('スペースのみの文字列でエラーをスローする', () => {
    expect(() => getConfigVolumeNames('   ')).toThrow('environmentId is required');
  });

  it('undefinedをキャストした場合エラーをスローする', () => {
    expect(() => getConfigVolumeNames(undefined as unknown as string)).toThrow('environmentId is required');
  });

  it('nullをキャストした場合エラーをスローする', () => {
    expect(() => getConfigVolumeNames(null as unknown as string)).toThrow('environmentId is required');
  });

  it('エラーメッセージが正確に一致する', () => {
    expect(() => getConfigVolumeNames('')).toThrow(new Error('environmentId is required'));
  });

  it('Volume名のプレフィックスが正しい', () => {
    const result = getConfigVolumeNames('test-id');
    expect(result.claudeVolume).toMatch(/^claude-config-claude-/);
    expect(result.configClaudeVolume).toMatch(/^claude-config-configclaude-/);
  });

  it('environmentIdがtrimされずそのままVolume名に含まれる', () => {
    const result = getConfigVolumeNames('  spaced  ');
    // trim()はバリデーションのみに使われ、Volume名生成にはそのまま使われる
    expect(result.claudeVolume).toBe('claude-config-claude-  spaced  ');
  });
});
