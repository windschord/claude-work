/**
 * action-detectorのテスト
 * Task 43.17: ANSIエスケープ除去とアクション要求パターン検出
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stripAnsi, detectActionRequest, createCooldownChecker } from '../action-detector';

describe('stripAnsi', () => {
  it('ANSIエスケープシーケンスを除去する', () => {
    const input = '\u001b[32mGreen Text\u001b[0m';
    expect(stripAnsi(input)).toBe('Green Text');
  });

  it('複数のANSIエスケープシーケンスを除去する', () => {
    const input = '\u001b[1m\u001b[31mBold Red\u001b[0m \u001b[34mBlue\u001b[0m';
    expect(stripAnsi(input)).toBe('Bold Red Blue');
  });

  it('ANSIエスケープがないテキストはそのまま返す', () => {
    const input = 'Plain text without escapes';
    expect(stripAnsi(input)).toBe('Plain text without escapes');
  });

  it('カーソル移動シーケンスを除去する', () => {
    const input = '\u001b[2J\u001b[H\u001b[3;4HText at position';
    expect(stripAnsi(input)).toBe('Text at position');
  });

  it('空文字列を処理できる', () => {
    expect(stripAnsi('')).toBe('');
  });
});

describe('detectActionRequest', () => {
  it('"Allow"/"Deny"パターンを検出する', () => {
    const text = 'Do you want to allow this action?\n[Allow] [Deny]';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('"Do you want to"パターンを検出する', () => {
    const text = 'Do you want to proceed with this operation?';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('"y/n"パターンを検出する', () => {
    const text = 'Continue? (y/n)';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('"yes/no"パターンを検出する', () => {
    const text = 'Are you sure? [yes/no]';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('"Press any key"パターンを検出する', () => {
    const text = 'Press any key to continue...';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('通常のテキストでは検出されない', () => {
    const text = 'This is just a normal log message';
    expect(detectActionRequest(text)).toBe(false);
  });

  it('大文字小文字を区別しない', () => {
    const text = 'DO YOU WANT TO proceed?';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('ANSIエスケープを含むテキストでも検出できる', () => {
    const text = '\u001b[33mDo you want to\u001b[0m allow this?';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('空文字列では検出されない', () => {
    expect(detectActionRequest('')).toBe(false);
  });
});

describe('createCooldownChecker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('初回呼び出しではtrueを返す', () => {
    const shouldNotify = createCooldownChecker(5000);
    expect(shouldNotify()).toBe(true);
  });

  it('クールダウン期間内の再呼び出しではfalseを返す', () => {
    const shouldNotify = createCooldownChecker(5000);

    expect(shouldNotify()).toBe(true);
    expect(shouldNotify()).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(shouldNotify()).toBe(false);
  });

  it('クールダウン期間後の呼び出しではtrueを返す', () => {
    const shouldNotify = createCooldownChecker(5000);

    expect(shouldNotify()).toBe(true);

    vi.advanceTimersByTime(5001);
    expect(shouldNotify()).toBe(true);
  });

  it('異なるクールダウン期間を設定できる', () => {
    const shouldNotify = createCooldownChecker(1000);

    expect(shouldNotify()).toBe(true);

    vi.advanceTimersByTime(500);
    expect(shouldNotify()).toBe(false);

    vi.advanceTimersByTime(600);
    expect(shouldNotify()).toBe(true);
  });

  it('複数回連続でtrueを返した後もクールダウンが機能する', () => {
    const shouldNotify = createCooldownChecker(5000);

    expect(shouldNotify()).toBe(true);

    vi.advanceTimersByTime(5001);
    expect(shouldNotify()).toBe(true);

    vi.advanceTimersByTime(5001);
    expect(shouldNotify()).toBe(true);

    expect(shouldNotify()).toBe(false);
  });
});
