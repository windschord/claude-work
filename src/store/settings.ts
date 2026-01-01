import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 設定ストアの型定義
 */
export interface SettingsState {
  /** デフォルトのClaudeモデル */
  defaultModel: string;

  /** デフォルトモデルを設定 */
  setDefaultModel: (model: string) => void;

  /** 設定をリセット */
  resetSettings: () => void;
}

/**
 * 初期状態
 */
const initialState = {
  defaultModel: 'auto',
};

/**
 * 設定管理用のZustandストア
 *
 * アプリケーション設定を管理し、localStorageに永続化します。
 * Reactコンポーネントから`useSettingsStore()`フックで利用できます。
 *
 * @example
 * ```typescript
 * import { useSettingsStore } from '@/store/settings';
 *
 * function MyComponent() {
 *   const { defaultModel, setDefaultModel } = useSettingsStore();
 *   // ...
 * }
 * ```
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setDefaultModel: (model) =>
        set({ defaultModel: model }),

      resetSettings: () =>
        set(initialState),
    }),
    {
      name: 'claudework:settings',
    }
  )
);
