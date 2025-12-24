'use client';

import { MessageDisplay } from './MessageDisplay';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatOutputProps {
  messages: Message[];
}

export function ChatOutput({ messages }: ChatOutputProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-3xl rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-sm">
                {message.role === 'user' ? 'You' : 'Claude Code'}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {message.role === 'assistant' ? (
              <MessageDisplay content={message.content} />
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
