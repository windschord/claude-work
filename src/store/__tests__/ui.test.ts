/**
 * useUIStoreのテスト
 * タスク44.3: プロジェクト展開状態を管理するストア
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from '../ui';

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

describe('useUIStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useUIStore.setState({
      collapsedProjects: new Set(),
    });
    localStorageMock.clear();
  });

  describe('isProjectExpanded', () => {
    it('デフォルトでtrueを返す（新規プロジェクト）', () => {
      const { isProjectExpanded } = useUIStore.getState();
      expect(isProjectExpanded('project-1')).toBe(true);
      expect(isProjectExpanded('project-2')).toBe(true);
    });

    it('折りたたまれたプロジェクトはfalseを返す', () => {
      useUIStore.setState({
        collapsedProjects: new Set(['project-1']),
      });

      const { isProjectExpanded } = useUIStore.getState();
      expect(isProjectExpanded('project-1')).toBe(false);
      expect(isProjectExpanded('project-2')).toBe(true);
    });
  });

  describe('toggleProject', () => {
    it('展開状態のプロジェクトを折りたたむ', () => {
      const { toggleProject, isProjectExpanded } = useUIStore.getState();

      // 初期状態は展開
      expect(isProjectExpanded('project-1')).toBe(true);

      // トグルで折りたたみ
      toggleProject('project-1');
      expect(useUIStore.getState().isProjectExpanded('project-1')).toBe(false);
    });

    it('折りたたまれたプロジェクトを展開する', () => {
      useUIStore.setState({
        collapsedProjects: new Set(['project-1']),
      });

      const { toggleProject } = useUIStore.getState();

      // 初期状態は折りたたみ
      expect(useUIStore.getState().isProjectExpanded('project-1')).toBe(false);

      // トグルで展開
      toggleProject('project-1');
      expect(useUIStore.getState().isProjectExpanded('project-1')).toBe(true);
    });

    it('複数のプロジェクトを独立して管理できる', () => {
      const { toggleProject } = useUIStore.getState();

      // project-1のみ折りたたむ
      toggleProject('project-1');

      const state = useUIStore.getState();
      expect(state.isProjectExpanded('project-1')).toBe(false);
      expect(state.isProjectExpanded('project-2')).toBe(true);
      expect(state.isProjectExpanded('project-3')).toBe(true);
    });
  });

  describe('setProjectExpanded', () => {
    it('プロジェクトを明示的に展開できる', () => {
      useUIStore.setState({
        collapsedProjects: new Set(['project-1']),
      });

      const { setProjectExpanded } = useUIStore.getState();
      setProjectExpanded('project-1', true);

      expect(useUIStore.getState().isProjectExpanded('project-1')).toBe(true);
    });

    it('プロジェクトを明示的に折りたためる', () => {
      const { setProjectExpanded } = useUIStore.getState();
      setProjectExpanded('project-1', false);

      expect(useUIStore.getState().isProjectExpanded('project-1')).toBe(false);
    });
  });

  describe('永続化', () => {
    it('persistストアとして設定されている', () => {
      expect(useUIStore.persist).toBeDefined();
      expect(typeof useUIStore.persist.getOptions).toBe('function');
      expect(useUIStore.persist.getOptions().name).toBe('claudework:ui');
    });
  });

  describe('resetUI', () => {
    it('すべてのプロジェクトを展開状態にリセットする', () => {
      useUIStore.setState({
        collapsedProjects: new Set(['project-1', 'project-2']),
      });

      const { resetUI } = useUIStore.getState();
      resetUI();

      const state = useUIStore.getState();
      expect(state.isProjectExpanded('project-1')).toBe(true);
      expect(state.isProjectExpanded('project-2')).toBe(true);
    });
  });
});
