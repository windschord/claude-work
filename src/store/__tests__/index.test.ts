/**
 * useAppStoreのテスト
 * Task 43.10: currentSessionId追加
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../index';

describe('useAppStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useAppStore.getState().reset();
  });

  describe('currentSessionId', () => {
    it('初期値はnull', () => {
      const { currentSessionId } = useAppStore.getState();
      expect(currentSessionId).toBeNull();
    });

    it('setCurrentSessionIdでcurrentSessionIdが更新される', () => {
      const { setCurrentSessionId } = useAppStore.getState();

      setCurrentSessionId('session-123');

      expect(useAppStore.getState().currentSessionId).toBe('session-123');
    });

    it('setCurrentSessionIdでnullに戻せる', () => {
      const { setCurrentSessionId } = useAppStore.getState();

      setCurrentSessionId('session-123');
      setCurrentSessionId(null);

      expect(useAppStore.getState().currentSessionId).toBeNull();
    });

    it('resetでcurrentSessionIdがnullに戻る', () => {
      const { setCurrentSessionId, reset } = useAppStore.getState();

      setCurrentSessionId('session-123');
      reset();

      expect(useAppStore.getState().currentSessionId).toBeNull();
    });
  });
});
