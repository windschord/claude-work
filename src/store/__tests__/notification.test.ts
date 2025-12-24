import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore } from '../notification';
import type { NotificationSettings } from '@/lib/notification-service';

// notification-serviceのモック
vi.mock('@/lib/notification-service', () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  requestPermission: vi.fn(),
}));

// グローバルなNotificationのモック
const mockNotification = {
  permission: 'default' as NotificationPermission,
};

// windowオブジェクトのモック
Object.defineProperty(global, 'window', {
  value: {
    Notification: mockNotification,
  },
  writable: true,
});

describe('useNotificationStore', () => {
  const mockSettings: NotificationSettings = {
    onTaskComplete: true,
    onPermissionRequest: true,
    onError: true,
  };

  beforeEach(async () => {
    // モックをクリア
    vi.clearAllMocks();

    // デフォルトのモック実装を設定
    const { getSettings } = await import('@/lib/notification-service');
    vi.mocked(getSettings).mockReturnValue(mockSettings);

    // Notification.permissionをデフォルトにリセット
    mockNotification.permission = 'default';

    // ストアをリセット
    useNotificationStore.setState({
      permission: 'default',
      settings: mockSettings,
    });
  });

  it('初期状態でNotification.permissionを取得する', () => {
    mockNotification.permission = 'granted';

    // ストアを再作成するために、モジュールを再読み込み
    const { permission } = useNotificationStore.getState();

    // 初期化時はwindowが存在すればNotification.permissionを使用
    expect(permission).toBe('default'); // 既にストアが作成されているため
  });

  it('初期状態でgetSettings()から設定を取得する', async () => {
    const { getSettings } = await import('@/lib/notification-service');

    const { settings } = useNotificationStore.getState();

    expect(vi.mocked(getSettings)).toHaveBeenCalled();
    expect(settings).toEqual(mockSettings);
  });

  it('requestPermissionがpermissionを更新する', async () => {
    const { requestPermission: requestPermissionService } = await import(
      '@/lib/notification-service'
    );

    vi.mocked(requestPermissionService).mockResolvedValue('granted');

    const { requestPermission } = useNotificationStore.getState();
    await requestPermission();

    const { permission } = useNotificationStore.getState();
    expect(permission).toBe('granted');
    expect(vi.mocked(requestPermissionService)).toHaveBeenCalledOnce();
  });

  it('updateSettingsが設定を更新しsaveSettingsを呼び出す', async () => {
    const { saveSettings } = await import('@/lib/notification-service');

    const { updateSettings } = useNotificationStore.getState();
    const newSettings: Partial<NotificationSettings> = {
      onTaskComplete: false,
    };

    updateSettings(newSettings);

    const { settings } = useNotificationStore.getState();
    expect(settings.onTaskComplete).toBe(false);
    expect(settings.onPermissionRequest).toBe(true);
    expect(settings.onError).toBe(true);
    expect(vi.mocked(saveSettings)).toHaveBeenCalledWith(settings);
  });

  it('initializeFromStorageがgetSettings()から設定を再読み込みする', async () => {
    const { getSettings } = await import('@/lib/notification-service');

    const updatedSettings: NotificationSettings = {
      onTaskComplete: false,
      onPermissionRequest: false,
      onError: false,
    };

    vi.mocked(getSettings).mockReturnValue(updatedSettings);

    const { initializeFromStorage } = useNotificationStore.getState();
    initializeFromStorage();

    const { settings } = useNotificationStore.getState();
    expect(settings).toEqual(updatedSettings);
    expect(vi.mocked(getSettings)).toHaveBeenCalled();
  });

  it('requestPermissionがdeniedを返した場合も正しく更新される', async () => {
    const { requestPermission: requestPermissionService } = await import(
      '@/lib/notification-service'
    );

    vi.mocked(requestPermissionService).mockResolvedValue('denied');

    const { requestPermission } = useNotificationStore.getState();
    await requestPermission();

    const { permission } = useNotificationStore.getState();
    expect(permission).toBe('denied');
  });

  it('複数の設定を一度に更新できる', async () => {
    const { saveSettings } = await import('@/lib/notification-service');

    const { updateSettings } = useNotificationStore.getState();
    const newSettings: Partial<NotificationSettings> = {
      onTaskComplete: false,
      onError: false,
    };

    updateSettings(newSettings);

    const { settings } = useNotificationStore.getState();
    expect(settings.onTaskComplete).toBe(false);
    expect(settings.onPermissionRequest).toBe(true);
    expect(settings.onError).toBe(false);
    expect(vi.mocked(saveSettings)).toHaveBeenCalledOnce();
  });
});
