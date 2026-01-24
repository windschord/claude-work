'use client';

import { Monitor, Container, Server } from 'lucide-react';
import { Session } from '@/store';

interface EnvironmentBadgeProps {
  session: Session;
}

/**
 * 環境バッジコンポーネント
 *
 * セッションの実行環境を表示するバッジです。
 * 環境タイプに応じてアイコンと色を変更します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.session - 表示するセッション情報
 * @returns 環境バッジのJSX要素、または環境情報がない場合はnull
 */
export function EnvironmentBadge({ session }: EnvironmentBadgeProps) {
  // 新しい環境システムを使用している場合
  if (session.environment_name && session.environment_type) {
    const config = {
      HOST: {
        colors: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        Icon: Monitor,
      },
      DOCKER: {
        colors: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        Icon: Container,
      },
      SSH: {
        colors: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
        Icon: Server,
      },
    };

    const envConfig = config[session.environment_type];
    if (!envConfig) {
      // Unknown environment type - return null to avoid crashes
      return null;
    }

    const { colors, Icon } = envConfig;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
        <Icon size={12} />
        {session.environment_name}
      </span>
    );
  }

  // レガシーDockerモードの表示
  if (session.docker_mode) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
        <Container size={12} />
        Docker (Legacy)
      </span>
    );
  }

  return null;
}
