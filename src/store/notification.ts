import { create } from 'zustand';
import {
  NotificationSettings,
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  requestPermission as requestPermissionService,
} from '@/lib/notification-service';

interface NotificationState {
  permission: NotificationPermission;
  settings: NotificationSettings;
  isInitialized: boolean;
  requestPermission: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  /**
   * ブラウザAPIから通知設定を初期化する
   *
   * SSR時はブラウザAPIが利用できないため、クライアントサイドでのみ実行される。
   * 通知状態（permission、settings）にアクセスするコンポーネントは、
   * useEffectフック内でマウント時にこの関数を呼び出す必要がある。
   *
   * @example
   * ```tsx
   * useEffect(() => {
   *   initializeFromStorage();
   * }, [initializeFromStorage]);
   * ```
   */
  initializeFromStorage: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // SSR対応: 初期値は安全なデフォルト値を使用
  permission: 'default',
  settings: DEFAULT_SETTINGS,
  isInitialized: false,
  requestPermission: async () => {
    const result = await requestPermissionService();
    set({ permission: result });
  },
  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      saveSettings(updated);
      return { settings: updated };
    });
  },
  initializeFromStorage: () => {
    // クライアントサイドでのみ初期化
    if (typeof window === 'undefined' || get().isInitialized) {
      return;
    }
    const permission = 'Notification' in window ? Notification.permission : 'default';
    set({
      settings: getSettings(),
      permission,
      isInitialized: true,
    });
  },
}));
