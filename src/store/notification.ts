import { create } from 'zustand';
import {
  NotificationSettings,
  getSettings,
  saveSettings,
  requestPermission as requestPermissionService,
} from '@/lib/notification-service';

interface NotificationState {
  permission: NotificationPermission;
  settings: NotificationSettings;
  requestPermission: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  initializeFromStorage: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  permission: typeof window !== 'undefined' ? Notification.permission : 'default',
  settings: getSettings(),
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
    set({ settings: getSettings() });
  },
}));
