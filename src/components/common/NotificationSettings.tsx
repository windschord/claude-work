'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationStore } from '@/store/notification';

export function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { permission, settings, updateSettings, initializeFromStorage } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // クライアントサイドでストアを初期化
  useEffect(() => {
    initializeFromStorage();
  }, [initializeFromStorage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="通知設定"
      >
        {permission === 'granted' ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-4">
          <h3 className="font-medium mb-3">通知設定</h3>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">タスク完了</span>
            <input
              type="checkbox"
              checked={settings.onTaskComplete}
              onChange={(e) => updateSettings({ onTaskComplete: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">権限要求</span>
            <input
              type="checkbox"
              checked={settings.onPermissionRequest}
              onChange={(e) => updateSettings({ onPermissionRequest: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">エラー発生</span>
            <input
              type="checkbox"
              checked={settings.onError}
              onChange={(e) => updateSettings({ onError: e.target.checked })}
              className="rounded"
            />
          </label>

          {permission === 'denied' && (
            <p className="text-xs text-red-500 mt-2">
              ブラウザの通知がブロックされています
            </p>
          )}
        </div>
      )}
    </div>
  );
}
