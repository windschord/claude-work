'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ComponentPropsWithoutRef } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const inline = props.inline;

            return !inline && language ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
              >
                {children}
              </code>
            );
          },
          pre({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
            return <div className="my-4 overflow-x-auto">{children}</div>;
          },
          a({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          h1({ children, ...props }: ComponentPropsWithoutRef<'h1'>) {
            return (
              <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }: ComponentPropsWithoutRef<'h2'>) {
            return (
              <h2 className="text-xl font-bold mt-5 mb-3" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }: ComponentPropsWithoutRef<'h3'>) {
            return (
              <h3 className="text-lg font-bold mt-4 mb-2" {...props}>
                {children}
              </h3>
            );
          },
          p({ children, ...props }: ComponentPropsWithoutRef<'p'>) {
            return (
              <p className="mb-4 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },
          ul({ children, ...props }: ComponentPropsWithoutRef<'ul'>) {
            return (
              <ul className="list-disc list-inside mb-4 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }: ComponentPropsWithoutRef<'ol'>) {
            return (
              <ol className="list-decimal list-inside mb-4 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }: ComponentPropsWithoutRef<'li'>) {
            return (
              <li className="ml-4" {...props}>
                {children}
              </li>
            );
          },
          blockquote({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) {
            return (
              <blockquote
                className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          table({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-300" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }: ComponentPropsWithoutRef<'thead'>) {
            return (
              <thead className="bg-gray-100" {...props}>
                {children}
              </thead>
            );
          },
          th({ children, ...props }: ComponentPropsWithoutRef<'th'>) {
            return (
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }: ComponentPropsWithoutRef<'td'>) {
            return (
              <td className="border border-gray-300 px-4 py-2" {...props}>
                {children}
              </td>
            );
          },
          hr({ ...props }: ComponentPropsWithoutRef<'hr'>) {
            return <hr className="my-6 border-t border-gray-300" {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
