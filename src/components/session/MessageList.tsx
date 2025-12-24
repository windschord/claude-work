'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/store';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
}

/**
 * メッセージリストコンポーネント
 *
 * メッセージの一覧を表示し、新しいメッセージが追加されたときに自動的にスクロールします。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.messages - 表示するメッセージの配列
 * @returns メッセージリストのJSX要素
 */
export default function MessageList({ messages }: MessageListProps) {
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
    </div>
  );
}
