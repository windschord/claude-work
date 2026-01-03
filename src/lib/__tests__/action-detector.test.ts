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

  // Phase 44: 追加テスト
  it('OSCシーケンス（ウィンドウタイトル等）を除去する', () => {
    const input = '\u001b]0;Window Title\u0007Content';
    expect(stripAnsi(input)).toBe('Content');
  });

  it('DCSシーケンスを除去する', () => {
    const input = '\u001bPsome data\u001b\\Visible Text';
    expect(stripAnsi(input)).toBe('Visible Text');
  });

  it('複合的なエスケープシーケンスを除去する', () => {
    const input = '\u001b[32m\u001b]0;Title\u0007Green\u001b[0m';
    expect(stripAnsi(input)).toBe('Green');
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

  // Phase 44: 追加テスト
  it('"Yes to confirm"パターンを検出する', () => {
    const text = 'Type Yes to confirm this action:';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('"Confirm with yes"パターンを検出する', () => {
    const text = 'Confirm with yes to proceed';
    expect(detectActionRequest(text)).toBe(true);
  });

  it('短すぎる出力は無視される', () => {
    const text = 'y/n'; // 3文字だけ
    expect(detectActionRequest(text)).toBe(false);
  });

  it('十分な長さがあれば検出される', () => {
    const text = 'Please confirm (y/n)'; // 20文字
    expect(detectActionRequest(text)).toBe(true);
  });

  it('Allow|Denyパターン（パイプ区切り）を検出する', () => {
    const text = 'Do you allow this? Allow|Deny';
    expect(detectActionRequest(text)).toBe(true);
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
