'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * テーマ切り替えボタンコンポーネント
 *
 * ライトモード、ダークモード、システムテーマを3段階で切り替えるボタンを提供します。
 * - ライトモード時: 太陽アイコン表示
 * - ダークモード時: 月アイコン表示
 * - システムモード時: モニターアイコン表示
 * - クリックで light → dark → system → light の順にテーマを切り替え
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const getIcon = () => {
    if (theme === 'light') {
      return <Sun className="w-5 h-5 text-yellow-500" />;
    } else if (theme === 'dark') {
      return <Moon className="w-5 h-5 text-blue-400" />;
    } else {
      return <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
    >
      {getIcon()}
    </button>
  );
}
