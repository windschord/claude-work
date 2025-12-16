'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface MessageDisplayProps {
  content: string;
}

interface CodeProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function MessageDisplay({ content }: MessageDisplayProps) {
  const components: Components = {
    code(props) {
      const { node: _node, inline, className, children, ...rest } = props as CodeProps;
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && typeof children === 'string') {
        return (
          <CodeBlock language={language}>
            {children.replace(/\n$/, '')}
          </CodeBlock>
        );
      }

      return (
        <code
          className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"
          {...rest}
        >
          {children}
        </code>
      );
    },
    a(props) {
      const { node: _node, children, href, ...rest } = props;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
          {...rest}
        >
          {children}
        </a>
      );
    },
    h1(props) {
      const { node: _node, children, ...rest } = props;
      return (
        <h1 className="text-2xl font-bold mt-4 mb-2" {...rest}>
          {children}
        </h1>
      );
    },
    h2(props) {
      const { node: _node, children, ...rest } = props;
      return (
        <h2 className="text-xl font-bold mt-3 mb-2" {...rest}>
          {children}
        </h2>
      );
    },
    h3(props) {
      const { node: _node, children, ...rest } = props;
      return (
        <h3 className="text-lg font-bold mt-2 mb-1" {...rest}>
          {children}
        </h3>
      );
    },
    ul(props) {
      const { node: _node, children, ...rest } = props;
      return (
        <ul className="list-disc list-inside my-2" {...rest}>
          {children}
        </ul>
      );
    },
    ol(props) {
      const { node: _node, children, ...rest } = props;
      return (
        <ol className="list-decimal list-inside my-2" {...rest}>
          {children}
        </ol>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
