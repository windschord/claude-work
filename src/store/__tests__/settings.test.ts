/**
 * useSettingsStoreのテスト
 * Task 43.11: デフォルトモデル設定を管理するストア
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../settings';

// localStorageをモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSettingsStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useSettingsStore.setState({
      defaultModel: 'auto',
    });
    localStorageMock.clear();
  });

  it('初期値がautoである', () => {
    const { defaultModel } = useSettingsStore.getState();
    expect(defaultModel).toBe('auto');
  });

  it('setDefaultModelで値が更新される', () => {
    const { setDefaultModel } = useSettingsStore.getState();

    setDefaultModel('claude-opus-4');

    expect(useSettingsStore.getState().defaultModel).toBe('claude-opus-4');
  });

  it('様々なモデル値を設定できる', () => {
    const { setDefaultModel } = useSettingsStore.getState();

    const models = ['auto', 'claude-opus-4', 'claude-sonnet-4', 'claude-haiku'];

    models.forEach((model) => {
      setDefaultModel(model);
      expect(useSettingsStore.getState().defaultModel).toBe(model);
    });
  });

  it('persistストアとして設定されている', () => {
    // persist middlewareが設定されていることを確認
    // zustandのpersist middlewareはpersist属性を追加する
    expect(useSettingsStore.persist).toBeDefined();
    expect(typeof useSettingsStore.persist.getOptions).toBe('function');
    expect(useSettingsStore.persist.getOptions().name).toBe('claudework:settings');
  });

  it('resetSettingsで初期値に戻る', () => {
    const { setDefaultModel, resetSettings } = useSettingsStore.getState();

    setDefaultModel('claude-opus-4');
    expect(useSettingsStore.getState().defaultModel).toBe('claude-opus-4');

    resetSettings();
    expect(useSettingsStore.getState().defaultModel).toBe('auto');
  });
});
