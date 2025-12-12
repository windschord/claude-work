'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/lib/api';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">メッセージがありません</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        if (message.role === 'system') {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm max-w-xl text-center">
                {message.content}
              </div>
            </div>
          );
        }

        if (message.role === 'user') {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="bg-blue-500 text-white px-4 py-2 rounded-lg max-w-xl break-words">
                {message.content}
              </div>
            </div>
          );
        }

        if (message.role === 'assistant') {
          return (
            <div key={message.id} className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg max-w-xl break-words">
                {message.content}
              </div>
            </div>
          );
        }

        return null;
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
