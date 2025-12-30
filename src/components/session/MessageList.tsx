'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/store';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

/**
 * メッセージリストコンポーネント
 *
 * メッセージの一覧を表示し、新しいメッセージが追加されたときに自動的にスクロールします。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.messages - 表示するメッセージの配列
 * @param props.isLoading - Claudeが応答中かどうか（オプション、デフォルト: false）
 * @returns メッセージリストのJSX要素
 */
export default function MessageList({ messages, isLoading = false }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      data-autoscroll="true"
      className="flex-1 overflow-y-auto p-4"
    >
      <ul role="list" className="space-y-0">
        {messages.map((message) => (
          <li key={message.id} role="listitem">
            <MessageBubble message={message} />
          </li>
        ))}
      </ul>
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="読み込み中"
          className="flex items-center gap-3 p-4 text-gray-500 dark:text-gray-400"
        >
          <div className="flex gap-1" aria-hidden="true">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm">Claudeが応答中...</span>
        </div>
      )}
    </div>
  );
}
