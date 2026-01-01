import toast from 'react-hot-toast';

export type NotificationEventType =
  | 'taskComplete'
  | 'permissionRequest'
  | 'error';

export interface NotificationSettings {
  onTaskComplete: boolean;
  onPermissionRequest: boolean;
  onError: boolean;
}

export interface NotificationEvent {
  type: NotificationEventType;
  sessionId: string;
  sessionName: string;
  message?: string;
}

const STORAGE_KEY = 'claudework:notification-settings';

export const DEFAULT_SETTINGS: NotificationSettings = {
  onTaskComplete: true,
  onPermissionRequest: true,
  onError: true,
};

/**
 * ローカルストレージから通知設定を読み込む
 *
 * @returns 保存された設定、または存在しない場合はデフォルト設定
 */
export function getSettings(): NotificationSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as NotificationSettings;
    // 必須フィールドの存在確認
    if (
      typeof parsed.onTaskComplete !== 'boolean' ||
      typeof parsed.onPermissionRequest !== 'boolean' ||
      typeof parsed.onError !== 'boolean'
    ) {
      return DEFAULT_SETTINGS;
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * 通知設定をローカルストレージに保存する
 *
 * @param settings - 保存する通知設定
 */
export function saveSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save notification settings:', error);
  }
}

/**
 * ブラウザ通知の許可をリクエストする
 *
 * @returns 許可の結果（'granted' | 'denied' | 'default'）
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

/**
 * タブがアクティブ（表示中）かどうかを確認する
 *
 * @returns タブがアクティブな場合はtrue
 */
export function isTabActive(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState === 'visible';
}

/**
 * イベント種別に応じたデフォルトメッセージを取得する
 *
 * @param type - イベント種別
 * @returns デフォルトメッセージ
 */
function getDefaultMessage(type: NotificationEventType): string {
  switch (type) {
    case 'taskComplete':
      return 'タスクが完了しました';
    case 'permissionRequest':
      return '権限確認が必要です';
    case 'error':
      return 'エラーが発生しました';
  }
}

/**
 * イベント種別に応じた設定キーを取得する
 *
 * @param type - イベント種別
 * @returns 設定のキー名
 */
function getSettingKey(type: NotificationEventType): keyof NotificationSettings {
  switch (type) {
    case 'taskComplete':
      return 'onTaskComplete';
    case 'permissionRequest':
      return 'onPermissionRequest';
    case 'error':
      return 'onError';
  }
}

/**
 * イベント種別に応じた通知タイトルを取得する
 *
 * @param event - 通知イベント
 * @returns 通知タイトル
 */
function getTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'taskComplete':
      return `タスク完了: ${event.sessionName}`;
    case 'permissionRequest':
      return `アクション要求: ${event.sessionName}`;
    case 'error':
      return `エラー発生: ${event.sessionName}`;
  }
}

/**
 * イベント種別に応じたデフォルトの通知本文を取得する
 *
 * @param event - 通知イベント
 * @returns デフォルトの通知本文
 */
function getDefaultBody(event: NotificationEvent): string {
  return getDefaultMessage(event.type);
}

/**
 * OS通知を表示する
 *
 * @param event - 通知イベント
 */
function showOSNotification(event: NotificationEvent): void {
  const notification = new Notification(getTitle(event), {
    body: event.message || getDefaultBody(event),
    icon: '/icon.png',
    tag: `claudework-${event.sessionId}`,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/sessions/${event.sessionId}`;
    notification.close();
  };
}

/**
 * 通知を送信する
 *
 * タブがアクティブな場合はtoast通知、
 * バックグラウンドの場合はOS通知を表示する
 *
 * @param event - 通知イベント
 */
export function sendNotification(event: NotificationEvent): void {
  const settings = getSettings();
  const settingKey = getSettingKey(event.type);

  // 設定で無効化されている場合はスキップ
  if (!settings[settingKey]) {
    return;
  }

  const message = event.message || getDefaultMessage(event.type);
  const fullMessage = `${event.sessionName}: ${message}`;

  if (isTabActive()) {
    // タブがアクティブな場合はtoast通知
    if (event.type === 'error') {
      toast.error(fullMessage);
    } else {
      toast.success(fullMessage);
    }
  } else {
    // タブがバックグラウンドの場合はOS通知
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      showOSNotification(event);
    }
  }
}
