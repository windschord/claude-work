import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  generateVolumeName,
  generateUniqueVolumeName,
  validateVolumeName,
} from '../volume-naming';

describe('generateSlug', () => {
  it('英数字とハイフンのみを含む文字列はそのまま小文字化', () => {
    expect(generateSlug('My-Project')).toBe('my-project');
    expect(generateSlug('claude-work')).toBe('claude-work');
  });

  it('スペースをハイフンに変換', () => {
    expect(generateSlug('My Project')).toBe('my-project');
    expect(generateSlug('hello world test')).toBe('hello-world-test');
  });

  it('特殊文字を除去', () => {
    expect(generateSlug('Test Project!!')).toBe('test-project');
    expect(generateSlug('foo@bar#baz')).toBe('foobarbaz');
  });

  it('連続ハイフンを1つに統合', () => {
    expect(generateSlug('foo--bar')).toBe('foo-bar');
    expect(generateSlug('a---b----c')).toBe('a-b-c');
  });

  it('先頭末尾のハイフンを除去', () => {
    expect(generateSlug('---leading-trailing---')).toBe('leading-trailing');
    expect(generateSlug('-test-')).toBe('test');
  });

  it('全て非ASCII文字の場合、空文字列を返す', () => {
    expect(generateSlug('日本語プロジェクト')).toBe('');
  });

  it('空文字列を入力した場合、空文字列を返す', () => {
    expect(generateSlug('')).toBe('');
  });

  it('アンダースコアとドットは保持する', () => {
    expect(generateSlug('foo_bar.baz')).toBe('foo_bar.baz');
  });

  it('混合入力を正しく処理する', () => {
    expect(generateSlug('My Project v2.0')).toBe('my-project-v2.0');
    expect(generateSlug('test_repo-123')).toBe('test_repo-123');
  });
});

describe('generateVolumeName', () => {
  it('repo種別でVolume名を生成', () => {
    expect(generateVolumeName('repo', 'my-project')).toBe('cw-repo-my-project');
    expect(generateVolumeName('repo', 'Claude Work')).toBe('cw-repo-claude-work');
  });

  it('config種別でVolume名を生成', () => {
    expect(generateVolumeName('config', 'default-docker')).toBe('cw-config-default-docker');
    expect(generateVolumeName('config', 'My Env')).toBe('cw-config-my-env');
  });

  it('スラッグが空の場合、fallbackIdを使用', () => {
    expect(generateVolumeName('repo', '日本語', 'a1b2c3d4')).toBe('cw-repo-a1b2c3d4');
  });

  it('スラッグが空でfallbackIdも未指定の場合、unknownを使用', () => {
    expect(generateVolumeName('repo', '日本語')).toBe('cw-repo-unknown');
  });
});

describe('generateUniqueVolumeName', () => {
  it('重複がない場合、サフィックスなし', () => {
    const result = generateUniqueVolumeName('repo', 'my-project', []);
    expect(result).toBe('cw-repo-my-project');
  });

  it('重複がある場合、-2サフィックスを追加', () => {
    const existing = ['cw-repo-my-project'];
    const result = generateUniqueVolumeName('repo', 'my-project', existing);
    expect(result).toBe('cw-repo-my-project-2');
  });

  it('連続する重複の場合、次の番号を使用', () => {
    const existing = ['cw-repo-my-project', 'cw-repo-my-project-2', 'cw-repo-my-project-3'];
    const result = generateUniqueVolumeName('repo', 'my-project', existing);
    expect(result).toBe('cw-repo-my-project-4');
  });

  it('異なる種別の同名は重複しない', () => {
    const existing = ['cw-config-my-project'];
    const result = generateUniqueVolumeName('repo', 'my-project', existing);
    expect(result).toBe('cw-repo-my-project');
  });

  it('fallbackIdを使用する場合も重複チェックする', () => {
    const existing = ['cw-repo-a1b2c3d4'];
    const result = generateUniqueVolumeName('repo', '日本語', existing, 'a1b2c3d4');
    expect(result).toBe('cw-repo-a1b2c3d4-2');
  });
});

describe('validateVolumeName', () => {
  it('有効なVolume名を受け入れ', () => {
    expect(validateVolumeName('cw-repo-my-project')).toBe(true);
    expect(validateVolumeName('my_volume.v1')).toBe(true);
    expect(validateVolumeName('a')).toBe(true);
    expect(validateVolumeName('claude-repo-abc123')).toBe(true);
  });

  it('先頭が非英数字の場合、拒否', () => {
    expect(validateVolumeName('-invalid')).toBe(false);
    expect(validateVolumeName('.invalid')).toBe(false);
    expect(validateVolumeName('_invalid')).toBe(false);
  });

  it('無効な文字を含む場合、拒否', () => {
    expect(validateVolumeName('invalid name')).toBe(false);
    expect(validateVolumeName('invalid/path')).toBe(false);
    expect(validateVolumeName('invalid:colon')).toBe(false);
  });

  it('空文字列を拒否', () => {
    expect(validateVolumeName('')).toBe(false);
  });
});
