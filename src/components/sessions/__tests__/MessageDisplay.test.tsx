import React from 'react';
import { render, screen } from '@testing-library/react';
import { MessageDisplay } from '../MessageDisplay';

describe('MessageDisplay', () => {
  it('マークダウンテキストが正しくレンダリングされる', () => {
    const content = '# Hello World\n\nThis is a **bold** text.';
    render(<MessageDisplay content={content} />);

    // 見出しが表示される
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World');

    // 太字テキストが表示される
    const boldText = screen.getByText(/bold/);
    expect(boldText).toBeInTheDocument();
  });

  it('見出し、リスト、リンクが正しくレンダリングされる', () => {
    const content = `
# Heading 1
## Heading 2
### Heading 3

- Item 1
- Item 2

1. First
2. Second

[Link](https://example.com)
`;
    render(<MessageDisplay content={content} />);

    // 見出しの確認
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading 3');

    // リストの確認
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();

    // リンクの確認
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('インラインコードが正しくスタイリングされる', () => {
    const content = 'This is `inline code` in text.';
    render(<MessageDisplay content={content} />);

    const inlineCode = screen.getByText('inline code');
    expect(inlineCode).toBeInTheDocument();
    expect(inlineCode.tagName).toBe('CODE');
  });

  it('コードブロックが正しくレンダリングされる', () => {
    const content = '```javascript\nconst x = 10;\n```';
    render(<MessageDisplay content={content} />);

    expect(screen.getByText(/const x = 10/)).toBeInTheDocument();
  });

  it('GitHub Flavored Markdownが正しく処理される', () => {
    const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |

~~strikethrough~~
`;
    render(<MessageDisplay content={content} />);

    // テーブルの確認
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();

    // 取り消し線の確認
    expect(screen.getByText('strikethrough')).toBeInTheDocument();
  });
});
