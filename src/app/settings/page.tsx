'use client';

import Link from 'next/link';
import { Settings, Server, Key } from 'lucide-react';

interface SettingCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

/**
 * 設定カードコンポーネント
 *
 * 設定ページへのナビゲーションカードを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.href - 遷移先のURL
 * @param props.icon - カードのアイコン
 * @param props.title - カードのタイトル
 * @param props.description - カードの説明文
 * @returns 設定カードのJSX要素
 */
function SettingCard({ href, icon, title, description }: SettingCardProps) {
  return (
    <Link
      href={href}
      className="group block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-all duration-200 hover:border-blue-500 dark:hover:border-blue-400"
    >
      <div className="flex flex-col h-full">
        <div className="mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

/**
 * 設定ページ
 *
 * 各種設定へのナビゲーションハブとして機能します。
 * カード形式で以下の設定ページへのリンクを提供します。
 * - アプリケーション設定
 * - 実行環境管理
 * - GitHub PAT管理
 */
export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">設定</h1>
        <p className="text-gray-600 dark:text-gray-400">
          ClaudeWorkの各種設定を管理します。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SettingCard
          href="/settings/app"
          icon={<Settings className="w-8 h-8" />}
          title="アプリケーション設定"
          description="Git Cloneタイムアウトやデバッグモードなどのアプリケーション設定を管理します。"
        />

        <SettingCard
          href="/settings/environments"
          icon={<Server className="w-8 h-8" />}
          title="実行環境"
          description="Claude Code実行環境の管理（HOST、DOCKER、SSH）を行います。"
        />

        <SettingCard
          href="/settings/github-pat"
          icon={<Key className="w-8 h-8" />}
          title="GitHub PAT"
          description="GitHubリポジトリアクセス用のPersonal Access Token管理を行います。"
        />
      </div>
    </div>
  );
}
