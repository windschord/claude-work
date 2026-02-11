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
  playNotificationSound,
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

// AudioContext モック
const mockOscillator = {
  connect: vi.fn(),
  type: 'sine' as OscillatorType,
  frequency: {
    setValueAtTime: vi.fn(),
  },
  start: vi.fn(),
  stop: vi.fn(),
  onended: null as (() => void) | null,
};

const mockGain = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
};

const mockAudioContext = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGain),
  destination: {},
  currentTime: 0,
  close: vi.fn(),
};

// AudioContextをクラスとしてモック（new演算子で使用されるため）
class MockAudioContextClass {
  createOscillator = mockAudioContext.createOscillator;
  createGain = mockAudioContext.createGain;
  destination = mockAudioContext.destination;
  currentTime = mockAudioContext.currentTime;
  close = mockAudioContext.close;
}

vi.stubGlobal('AudioContext', MockAudioContextClass);

describe('notification-service', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    mockNotification.permission = 'default';
    mockNotification.requestPermission = vi.fn().mockResolvedValue('granted');

    // AudioContextモックの再設定（clearAllMocksで実装がクリアされるため）
    mockAudioContext.createOscillator.mockReturnValue(mockOscillator);
    mockAudioContext.createGain.mockReturnValue(mockGain);
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
        onActionRequired: false,
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
        onActionRequired: true,
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
        onActionRequired: true,
      });
    });
  });

  describe('saveSettings', () => {
    it('設定をローカルストレージに保存する', () => {
      const settings: NotificationSettings = {
        onTaskComplete: false,
        onPermissionRequest: true,
        onError: false,
        onActionRequired: true,
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

  describe('playNotificationSound', () => {
    it('Web Audio APIを使って通知音を再生する', () => {
      playNotificationSound();

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockOscillator.connect).toHaveBeenCalledWith(mockGain);
      expect(mockGain.connect).toHaveBeenCalledWith(mockAudioContext.destination);
      expect(mockOscillator.start).toHaveBeenCalled();
      expect(mockOscillator.stop).toHaveBeenCalled();
    });

    it('AudioContextが利用できない場合エラーを投げない', () => {
      const originalAudioContext = globalThis.AudioContext;
      // @ts-expect-error - Testing undefined AudioContext
      globalThis.AudioContext = undefined;

      expect(() => playNotificationSound()).not.toThrow();

      globalThis.AudioContext = originalAudioContext;
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
        onActionRequired: false,
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
        onActionRequired: true,
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
        onActionRequired: true,
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

    it('OS通知許可がある場合はOS通知を表示する（タブアクティブでも）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      sendNotification(mockEvent);

      // OS通知が表示される（タブ状態に関係なく）
      expect(mockNotification).toHaveBeenCalledWith('タスク完了: Test Session', {
        body: 'タスクが完了しました',
        icon: '/icon.png',
        tag: 'claudework-session-123',
      });
      // toast通知は表示されない
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('OS通知許可がない場合はtoast通知にフォールバック（taskComplete）', () => {
      mockNotification.permission = 'denied';
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

    it('OS通知許可がない場合はtoast通知にフォールバック（error）', () => {
      mockNotification.permission = 'denied';
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

    it('バックグラウンドでもOS通知許可がない場合はtoast通知にフォールバック', () => {
      mockNotification.permission = 'denied';
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      sendNotification(mockEvent);

      expect(toast.success).toHaveBeenCalledWith(
        'Test Session: タスクが完了しました'
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
      expect(mockNotification).toHaveBeenCalledWith('タスク完了: Test Session', {
        body: 'タスクが完了しました',
        icon: '/icon.png',
        tag: 'claudework-session-123',
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
      expect(mockNotification).toHaveBeenCalledWith('アクション要求: Another Session', {
        body: '権限確認が必要です',
        icon: '/icon.png',
        tag: 'claudework-session-456',
      });
    });

    it('messageが未指定の場合デフォルトメッセージを使用（taskComplete）', () => {
      mockNotification.permission = 'denied';
      const event: NotificationEvent = {
        type: 'taskComplete',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith('Test Session: タスクが完了しました');
    });

    it('messageが未指定の場合デフォルトメッセージを使用（permissionRequest）', () => {
      mockNotification.permission = 'denied';
      const event: NotificationEvent = {
        type: 'permissionRequest',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith('Test Session: 権限確認が必要です');
    });

    it('messageが未指定の場合デフォルトメッセージを使用（error）', () => {
      mockNotification.permission = 'denied';
      const event: NotificationEvent = {
        type: 'error',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.error).toHaveBeenCalledWith('Test Session: エラーが発生しました');
    });

    // Task 43.19: actionRequiredイベントタイプのテスト
    it('actionRequiredイベントが処理される（OS通知）', () => {
      const event: NotificationEvent = {
        type: 'actionRequired',
        sessionId: 'session-123',
        sessionName: 'Test Session',
        message: 'Claudeがアクションを求めています',
      };

      sendNotification(event);

      expect(mockNotification).toHaveBeenCalledWith('アクション要求: Test Session', {
        body: 'Claudeがアクションを求めています',
        icon: '/icon.png',
        tag: 'claudework-session-123',
      });
    });

    it('actionRequiredイベントがOS通知許可なしの場合toastにフォールバック', () => {
      mockNotification.permission = 'denied';
      const event: NotificationEvent = {
        type: 'actionRequired',
        sessionId: 'session-123',
        sessionName: 'Test Session',
        message: 'Claudeがアクションを求めています',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith(
        'Test Session: Claudeがアクションを求めています'
      );
    });

    it('設定が無効の場合actionRequiredをスキップ', () => {
      const settings: NotificationSettings = {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: false,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      const event: NotificationEvent = {
        type: 'actionRequired',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('messageが未指定の場合デフォルトメッセージを使用（actionRequired）', () => {
      mockNotification.permission = 'denied';
      const event: NotificationEvent = {
        type: 'actionRequired',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(toast.success).toHaveBeenCalledWith('Test Session: アクションが必要です');
    });

    it('タブがバックグラウンドの場合OS通知を表示（actionRequired）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'actionRequired',
        sessionId: 'session-action',
        sessionName: 'Action Session',
        message: '確認が必要です',
      };

      sendNotification(event);

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockNotification).toHaveBeenCalledWith('アクション要求: Action Session', {
        body: '確認が必要です',
        icon: '/icon.png',
        tag: 'claudework-session-action',
      });
    });

    it('通知時に通知音が再生される', () => {
      sendNotification(mockEvent);

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockOscillator.start).toHaveBeenCalled();
    });

    it('設定が無効の場合通知音も再生されない', () => {
      const settings: NotificationSettings = {
        onTaskComplete: false,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: false,
      };
      mockLocalStorage.setItem(
        'claudework:notification-settings',
        JSON.stringify(settings)
      );

      sendNotification(mockEvent);

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('OS通知クリック時にウィンドウがフォーカスされセッションページに遷移する（taskComplete）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const mockFocus = vi.fn();
      const mockClose = vi.fn();
      let capturedOnClick: (() => void) | null = null;
      let capturedHref: string | null = null;

      Object.defineProperty(window, 'focus', {
        value: mockFocus,
        writable: true,
      });

      // window.location.href への代入をキャプチャ
      Object.defineProperty(window, 'location', {
        value: {
          set href(value: string) {
            capturedHref = value;
          },
          get href() {
            return capturedHref || 'http://localhost:3000/';
          },
        },
        writable: true,
      });

      // コンストラクタとして動作するモックを作成
      const NotificationConstructor = function (
        this: { onclick: (() => void) | null; close: () => void },
        _title: string,
        _options: NotificationOptions
      ) {
        this.onclick = null;
        this.close = mockClose;
        // onclickプロパティに代入された値をキャプチャするためのプロキシ
        Object.defineProperty(this, 'onclick', {
          set: (handler) => {
            capturedOnClick = handler;
          },
          get: () => capturedOnClick,
        });
      } as unknown as typeof Notification;

      NotificationConstructor.permission = 'granted';

      Object.defineProperty(global, 'Notification', {
        value: NotificationConstructor,
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'taskComplete',
        sessionId: 'session-123',
        sessionName: 'Test Session',
      };

      sendNotification(event);

      expect(capturedOnClick).toBeDefined();

      // onclickハンドラを実行
      if (capturedOnClick) {
        capturedOnClick();
      }

      expect(mockFocus).toHaveBeenCalledOnce();
      expect(capturedHref).toBe('/sessions/session-123');
      expect(mockClose).toHaveBeenCalledOnce();

      // モックを元に戻す
      Object.defineProperty(global, 'Notification', {
        value: mockNotification,
        writable: true,
      });
    });

    it('OS通知クリック時にウィンドウがフォーカスされセッションページに遷移する（permissionRequest）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const mockFocus = vi.fn();
      const mockClose = vi.fn();
      let capturedOnClick: (() => void) | null = null;
      let capturedHref: string | null = null;

      Object.defineProperty(window, 'focus', {
        value: mockFocus,
        writable: true,
      });

      // window.location.href への代入をキャプチャ
      Object.defineProperty(window, 'location', {
        value: {
          set href(value: string) {
            capturedHref = value;
          },
          get href() {
            return capturedHref || 'http://localhost:3000/';
          },
        },
        writable: true,
      });

      // コンストラクタとして動作するモックを作成
      const NotificationConstructor = function (
        this: { onclick: (() => void) | null; close: () => void },
        _title: string,
        _options: NotificationOptions
      ) {
        this.onclick = null;
        this.close = mockClose;
        // onclickプロパティに代入された値をキャプチャするためのプロキシ
        Object.defineProperty(this, 'onclick', {
          set: (handler) => {
            capturedOnClick = handler;
          },
          get: () => capturedOnClick,
        });
      } as unknown as typeof Notification;

      NotificationConstructor.permission = 'granted';

      Object.defineProperty(global, 'Notification', {
        value: NotificationConstructor,
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'permissionRequest',
        sessionId: 'session-456',
        sessionName: 'Another Session',
      };

      sendNotification(event);

      expect(capturedOnClick).toBeDefined();

      // onclickハンドラを実行
      if (capturedOnClick) {
        capturedOnClick();
      }

      expect(mockFocus).toHaveBeenCalledOnce();
      expect(capturedHref).toBe('/sessions/session-456');
      expect(mockClose).toHaveBeenCalledOnce();

      // モックを元に戻す
      Object.defineProperty(global, 'Notification', {
        value: mockNotification,
        writable: true,
      });
    });

    it('OS通知クリック時にウィンドウがフォーカスされセッションページに遷移する（error）', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      const mockFocus = vi.fn();
      const mockClose = vi.fn();
      let capturedOnClick: (() => void) | null = null;
      let capturedHref: string | null = null;

      Object.defineProperty(window, 'focus', {
        value: mockFocus,
        writable: true,
      });

      // window.location.href への代入をキャプチャ
      Object.defineProperty(window, 'location', {
        value: {
          set href(value: string) {
            capturedHref = value;
          },
          get href() {
            return capturedHref || 'http://localhost:3000/';
          },
        },
        writable: true,
      });

      // コンストラクタとして動作するモックを作成
      const NotificationConstructor = function (
        this: { onclick: (() => void) | null; close: () => void },
        _title: string,
        _options: NotificationOptions
      ) {
        this.onclick = null;
        this.close = mockClose;
        // onclickプロパティに代入された値をキャプチャするためのプロキシ
        Object.defineProperty(this, 'onclick', {
          set: (handler) => {
            capturedOnClick = handler;
          },
          get: () => capturedOnClick,
        });
      } as unknown as typeof Notification;

      NotificationConstructor.permission = 'granted';

      Object.defineProperty(global, 'Notification', {
        value: NotificationConstructor,
        writable: true,
      });

      const event: NotificationEvent = {
        type: 'error',
        sessionId: 'session-789',
        sessionName: 'Error Session',
      };

      sendNotification(event);

      expect(capturedOnClick).toBeDefined();

      // onclickハンドラを実行
      if (capturedOnClick) {
        capturedOnClick();
      }

      expect(mockFocus).toHaveBeenCalledOnce();
      expect(capturedHref).toBe('/sessions/session-789');
      expect(mockClose).toHaveBeenCalledOnce();

      // モックを元に戻す
      Object.defineProperty(global, 'Notification', {
        value: mockNotification,
        writable: true,
      });
    });
  });
});
