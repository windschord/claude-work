import toast from 'react-hot-toast';

export type NotificationEventType =
  | 'taskComplete'
  | 'permissionRequest'
  | 'error'
  | 'actionRequired';

export interface NotificationSettings {
  onTaskComplete: boolean;
  onPermissionRequest: boolean;
  onError: boolean;
  onActionRequired: boolean;
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
  onActionRequired: true,
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
    // onActionRequiredが存在しない場合はデフォルト値を追加（既存設定との後方互換性）
    if (typeof parsed.onActionRequired !== 'boolean') {
      parsed.onActionRequired = true;
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
    case 'actionRequired':
      return 'アクションが必要です';
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
    case 'actionRequired':
      return 'onActionRequired';
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
    case 'actionRequired':
      return `アクション要求: ${event.sessionName}`;
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
 * Web Audio APIを使って通知音を再生する
 *
 * 短いビープ音を生成して再生する。AudioContextが利用できない環境では何もしない。
 */
export function playNotificationSound(): void {
  try {
    const AudioCtx = typeof window !== 'undefined'
      ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    // 2音のチャイム風通知音
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);       // A5
    oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.15); // C#6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);

    oscillator.onended = () => {
      ctx.close();
    };
  } catch {
    // Audio再生に失敗しても通知自体は続行する
  }
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
 * ブラウザ内toast通知を表示する（フォールバック用）
 *
 * @param event - 通知イベント
 */
function showToastNotification(event: NotificationEvent): void {
  const message = event.message || getDefaultMessage(event.type);
  const fullMessage = `${event.sessionName}: ${message}`;

  if (event.type === 'error') {
    toast.error(fullMessage);
  } else {
    toast.success(fullMessage);
  }
}

/**
 * 通知を送信する
 *
 * OS通知の許可がある場合はOS通知を使用し、
 * 許可がない場合はブラウザ内toast通知にフォールバックする。
 * いずれの場合も通知音を再生する。
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

  // 通知音を再生
  playNotificationSound();

  // OS通知の許可がある場合はOS通知を使用
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    showOSNotification(event);
  } else {
    // OS通知が使えない場合はtoast通知にフォールバック
    showToastNotification(event);
  }
}
