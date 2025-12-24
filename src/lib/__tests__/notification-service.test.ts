import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// react-hot-toastのモック（import前に宣言）
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import toast from 'react-hot-toast';
import {
  getSettings,
  saveSettings,
  requestPermission,
  sendNotification,
  isTabActive,
  type NotificationSettings,
  type NotificationEvent,
} from '../notification-service';

// モック設定
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

const mockNotification = vi.fn();

// グローバルオブジェクトのモック
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    visibilityState: 'visible',
  },
  writable: true,
});

describe('notification-service', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    mockNotification.permission = 'default';
    mockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSettings', () => {
    it('ローカルストレージから設定を読み込む', () => {
      const settings: NotificationSettings = {
        onTaskComplete: false,
        onPermissionRequest: false,
        onError: true,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      const result = getSettings();

      expect(result).toEqual(settings);
    });

    it('設定がない場合デフォルト値を返す', () => {
      const result = getSettings();

      expect(result).toEqual({
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
      });
    });

    it('不正なJSON形式の場合デフォルト値を返す', () => {
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        'invalid json'
      );

      const result = getSettings();

      expect(result).toEqual({
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
      });
    });
  });

  describe('saveSettings', () => {
    it('設定をローカルストレージに保存する', () => {
      const settings: NotificationSettings = {
        onTaskComplete: false,
        onPermissionRequest: true,
        onError: false,
      };

      saveSettings(settings);

      const stored = mockLocalStorage.getItem('claudework:notification-settings');
      expect(stored).toBe(JSON.stringify(settings));
    });
  });

  describe('requestPermission', () => {
    it('Notification.requestPermission()を呼び出す', async () => {
      const result = await requestPermission();

      expect(mockNotification.requestPermission).toHaveBeenCalledOnce();
      expect(result).toBe('granted');
    });

    it('許可が拒否された場合deniedを返す', async () => {
      mockNotification.requestPermission = vi.fn().mockResolvedValue('denied');

      const result = await requestPermission();

      expect(result).toBe('denied');
    });

    it('Notification APIが利用できない場合deniedを返す', async () => {
      const originalNotification = global.Notification;
      // @ts-expect-error - Testing undefined Notification
      global.Notification = undefined;

      const result = await requestPermission();

      expect(result).toBe('denied');

      global.Notification = originalNotification;
    });
  });

  describe('isTabActive', () => {
    it('document.visibilityStateがvisibleの場合trueを返す', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      const result = isTabActive();

      expect(result).toBe(true);
    });

    it('document.visibilityStateがhiddenの場合falseを返す', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const result = isTabActive();

      expect(result).toBe(false);
    });
  });

  describe('sendNotification', () => {
    const mockEvent: NotificationEvent = {
      type: 'taskComplete',
      sessionId: 'session-123',
      sessionName: 'Test Session',
      message: 'タスクが完了しました',
    };

    beforeEach(() => {
      mockNotification.permission = 'granted';
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
    });

    it('設定が無効の場合通知をスキップ（taskComplete）', () => {
      const settings: NotificationSettings = {
        onTaskComplete: false,
        onPermissionRequest: true,
        onError: true,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      sendNotification(mockEvent);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('設定が無効の場合通知をスキップ（permissionRequest）', () => {
      const settings: NotificationSettings = {
        onTaskComplete: true,
        onPermissionRequest: false,
        onError: true,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      const event: NotificationEvent = {
        type: 'permissionRequest',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('設定が無効の場合通知をスキップ（error）', () => {
      const settings: NotificationSettings = {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: false,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      const event: NotificationEvent = {
        type: 'error',
        sessionId: 'session-123',
        sessionName: 'Test Session',
        message: 'エラーが発生しました',
      };

      sendNotification(event);

      expect(toast.error).not.toHaveBeenCalled();
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('タブがアクティブな場合toast通知を表示（taskComplete）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      sendNotification(mockEvent);

      expect(toast.success).toHaveBeenCalledWith(
        'Test Session: タスクが完了しました'
      );
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('タブがアクティブな場合toast通知を表示（error）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'error',
        sessionId: 'session-123',
        sessionName: 'Test Session',
        message: 'エラーが発生しました',
      };

      sendNotification(event);

      expect(toast.error).toHaveBeenCalledWith(
        'Test Session: エラーが発生しました'
      );
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('タブがバックグラウンドの場合OS通知を表示（taskComplete）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      sendNotification(mockEvent);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).toHaveBeenCalledWith('ClaudeWork', {
        body: 'Test Session: タスクが完了しました',
        icon: '/favicon.ico',
        tag: 'session-123',
      });
    });

    it('タブがバックグラウンドの場合OS通知を表示（permissionRequest）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'permissionRequest',
        sessionId: 'session-456',
        sessionName: 'Another Session',
        message: '権限確認が必要です',
      };

      sendNotification(event);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).toHaveBeenCalledWith('ClaudeWork', {
        body: 'Another Session: 権限確認が必要です',
        icon: '/favicon.ico',
        tag: 'session-456',
      });
    });

    it('許可されていない場合OS通知を送信しない', () => {
      mockNotification.permission = 'denied';
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      sendNotification(mockEvent);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('messageが未指定の場合デフォルトメッセージを使用（taskComplete）', () => {
      const event: NotificationEvent = {
        type: 'taskComplete',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith('Test Session: タスクが完了しました');
    });

    it('messageが未指定の場合デフォルトメッセージを使用（permissionRequest）', () => {
      const event: NotificationEvent = {
        type: 'permissionRequest',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith('Test Session: 権限確認が必要です');
    });

    it('messageが未指定の場合デフォルトメッセージを使用（error）', () => {
      const event: NotificationEvent = {
        type: 'error',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.error).toHaveBeenCalledWith('Test Session: エラーが発生しました');
    });
  });
});
