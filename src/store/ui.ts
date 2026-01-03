/**
 * UIストア
 * タスク44.3: プロジェクト展開状態を管理
 *
 * プロジェクトの展開/折りたたみ状態を管理し、localStorageに永続化します。
 * デフォルトでは全プロジェクトが展開状態です。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UIストアの型定義
 */
export interface UIState {
  /** 折りたたまれているプロジェクトIDのセット */
  collapsedProjects: Set<string>;

  /** プロジェクトが展開されているかを取得（デフォルトはtrue） */
  isProjectExpanded: (projectId: string) => boolean;

  /** プロジェクトの展開/折りたたみを切り替え */
  toggleProject: (projectId: string) => void;

  /** プロジェクトの展開状態を明示的に設定 */
  setProjectExpanded: (projectId: string, expanded: boolean) => void;

  /** UI状態をリセット（全展開） */
  resetUI: () => void;
}

/**
 * 初期状態
 */
const initialState = {
  collapsedProjects: new Set<string>(),
};

/**
 * UI管理用のZustandストア
 *
 * プロジェクトの展開/折りたたみ状態を管理し、localStorageに永続化します。
 * Reactコンポーネントから`useUIStore()`フックで利用できます。
 *
 * @example
 * ```typescript
 * import { useUIStore } from '@/store/ui';
 *
 * function ProjectList() {
 *   const { isProjectExpanded, toggleProject } = useUIStore();
 *
 *   return (
 *     <div onClick={() => toggleProject('project-1')}>
 *       {isProjectExpanded('project-1') ? 'Expanded' : 'Collapsed'}
 *     </div>
 *   );
 * }
 * ```
 */
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...initialState,

      isProjectExpanded: (projectId: string) => {
        return !get().collapsedProjects.has(projectId);
      },

      toggleProject: (projectId: string) => {
        set((state) => {
          const newCollapsed = new Set(state.collapsedProjects);
          if (newCollapsed.has(projectId)) {
            newCollapsed.delete(projectId);
          } else {
            newCollapsed.add(projectId);
          }
          return { collapsedProjects: newCollapsed };
        });
      },

      setProjectExpanded: (projectId: string, expanded: boolean) => {
        set((state) => {
          const newCollapsed = new Set(state.collapsedProjects);
          if (expanded) {
            newCollapsed.delete(projectId);
          } else {
            newCollapsed.add(projectId);
          }
          return { collapsedProjects: newCollapsed };
        });
      },

      resetUI: () => {
        set({ collapsedProjects: new Set<string>() });
      },
    }),
    {
      name: 'claudework:ui',
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            const parsed = JSON.parse(str);
            // Setをarrayから復元
            if (parsed.state?.collapsedProjects) {
              parsed.state.collapsedProjects = new Set(parsed.state.collapsedProjects);
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          // Setをarrayに変換して保存
          const toStore = {
            ...value,
            state: {
              ...value.state,
              collapsedProjects: Array.from(value.state.collapsedProjects || []),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          localStorage.removeItem(name);
        },
      },
    }
  )
);
