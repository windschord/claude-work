'use client';

import { Message } from '@/store';
import { MessageDisplay } from '@/components/sessions/MessageDisplay';

interface MessageBubbleProps {
  message: Message;
}

/**
 * メッセージバブルコンポーネント
 *
 * チャットメッセージを表示するバブルコンポーネントです。
 * ユーザーメッセージとアシスタントメッセージで異なるスタイルを適用します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.message - 表示するメッセージ情報
 * @returns メッセージバブルのJSX要素
 */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      data-role={message.role}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <MessageDisplay content={message.content} sub_agents={message.sub_agents} />
        )}
        <div
          className={`text-xs mt-1 ${
            isUser
              ? 'text-blue-100'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
