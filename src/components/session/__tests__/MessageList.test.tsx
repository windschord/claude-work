import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MessageList from '../MessageList';

describe('MessageList', () => {
  const mockMessages = [
    {
      id: 'msg-1',
      session_id: 'session-1',
      role: 'user',
      content: 'Hello, Claude!',
      sub_agents: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'msg-2',
      session_id: 'session-1',
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      sub_agents: null,
      created_at: '2024-01-01T00:01:00Z',
    },
    {
      id: 'msg-3',
      session_id: 'session-1',
      role: 'user',
      content: 'Can you help me with this task?',
      sub_agents: null,
      created_at: '2024-01-01T00:02:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('メッセージリストが表示される', () => {
    render(<MessageList messages={mockMessages} />);

    expect(screen.getByText('Hello, Claude!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('Can you help me with this task?')).toBeInTheDocument();
  });

  it('空のメッセージリストが表示される', () => {
    render(<MessageList messages={[]} />);

    const messageList = screen.getByRole('list');
    expect(messageList).toBeInTheDocument();
    expect(messageList.children.length).toBe(0);
  });

  it('ユーザーメッセージが正しい属性で表示される', () => {
    render(<MessageList messages={mockMessages} />);

    const userMessage = screen.getByText('Hello, Claude!').closest('[data-role]');
    expect(userMessage?.getAttribute('data-role')).toBe('user');
  });

  it('アシスタントメッセージが正しい属性で表示される', () => {
    render(<MessageList messages={mockMessages} />);

    const assistantMessage = screen.getByText('Hello! How can I help you today?').closest('[data-role]');
    expect(assistantMessage?.getAttribute('data-role')).toBe('assistant');
  });

  it('メッセージが時系列順に表示される', () => {
    render(<MessageList messages={mockMessages} />);

    const messageElements = screen.getAllByRole('listitem');
    expect(messageElements).toHaveLength(3);

    // Check order
    expect(messageElements[0]).toHaveTextContent('Hello, Claude!');
    expect(messageElements[1]).toHaveTextContent('Hello! How can I help you today?');
    expect(messageElements[2]).toHaveTextContent('Can you help me with this task?');
  });

  it('メッセージリストが自動スクロール用のrefを持つ', () => {
    const { container } = render(<MessageList messages={mockMessages} />);

    const scrollElement = container.querySelector('[data-autoscroll]');
    expect(scrollElement).toBeInTheDocument();
  });
});
