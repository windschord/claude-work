'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface SubAgent {
  name: string;
  output: string;
}

interface MessageDisplayProps {
  content: string;
  sub_agents?: string | null;
}

interface CodeProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function MessageDisplay({ content, sub_agents }: MessageDisplayProps) {
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

  // Parse sub_agents if it's a JSON string
  let parsedSubAgents: SubAgent[] | null = null;
  if (sub_agents) {
    try {
      parsedSubAgents = JSON.parse(sub_agents);
      // Ensure it's an array
      if (!Array.isArray(parsedSubAgents)) {
        parsedSubAgents = [parsedSubAgents];
      }
    } catch {
      // Invalid JSON, ignore
      parsedSubAgents = null;
    }
  }

  return (
    <div className="space-y-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>

      {parsedSubAgents && parsedSubAgents.length > 0 && (
        <div className="mt-4 space-y-2">
          {parsedSubAgents.map((subAgent, index) => (
            <Disclosure key={index} defaultOpen={false}>
              {({ open }) => (
                <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                  <Disclosure.Button className="flex w-full items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Sub-agent: {subAgent.name}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </Disclosure.Button>
                  <Transition
                    enter="transition duration-100 ease-out"
                    enterFrom="transform scale-95 opacity-0"
                    enterTo="transform scale-100 opacity-100"
                    leave="transition duration-75 ease-out"
                    leaveFrom="transform scale-100 opacity-100"
                    leaveTo="transform scale-95 opacity-0"
                  >
                    <Disclosure.Panel className="px-4 py-3 bg-white dark:bg-gray-900">
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {subAgent.output}
                      </div>
                    </Disclosure.Panel>
                  </Transition>
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      )}
    </div>
  );
}
