import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MessageDisplay } from '../MessageDisplay';

describe('MessageDisplay', () => {
  afterEach(() => {
    cleanup();
  });

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
    const { container } = render(<MessageDisplay content={content} />);

    const inlineCode = screen.getByText('inline code');
    expect(inlineCode).toBeInTheDocument();
    // インラインコードがCODEタグを含むことを確認
    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('inline code');
  });

  it('コードブロックが正しくレンダリングされる', () => {
    const content = '```javascript\nconst x = 10;\n```';
    const { container } = render(<MessageDisplay content={content} />);

    // コードブロック内のテキストを確認（シンタックスハイライトにより複数の要素に分割されるため、containerで確認）
    const codeElement = container.querySelector('code.language-javascript');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('const x = 10;');
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

  it('sub_agentsがnullの場合、サブエージェント出力は表示されない', () => {
    const content = 'Test message';
    render(<MessageDisplay content={content} sub_agents={null} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.queryByText(/Sub-agent:/)).not.toBeInTheDocument();
  });

  it('sub_agentsが空文字列の場合、サブエージェント出力は表示されない', () => {
    const content = 'Test message';
    render(<MessageDisplay content={content} sub_agents="" />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.queryByText(/Sub-agent:/)).not.toBeInTheDocument();
  });

  it('sub_agentsが無効なJSONの場合、サブエージェント出力は表示されない', () => {
    const content = 'Test message';
    render(<MessageDisplay content={content} sub_agents="invalid json" />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.queryByText(/Sub-agent:/)).not.toBeInTheDocument();
  });

  it('単一のsub_agentが正しく表示される', () => {
    const content = 'Main message';
    const subAgent = JSON.stringify({ name: 'Task Executor', output: 'Task completed successfully' });
    render(<MessageDisplay content={content} sub_agents={subAgent} />);

    expect(screen.getByText('Main message')).toBeInTheDocument();
    expect(screen.getByText('Sub-agent: Task Executor')).toBeInTheDocument();
  });

  it('複数のsub_agentsが正しく表示される', () => {
    const content = 'Main message';
    const subAgents = JSON.stringify([
      { name: 'Agent 1', output: 'Output from agent 1' },
      { name: 'Agent 2', output: 'Output from agent 2' },
    ]);
    render(<MessageDisplay content={content} sub_agents={subAgents} />);

    expect(screen.getByText('Main message')).toBeInTheDocument();
    expect(screen.getByText('Sub-agent: Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Sub-agent: Agent 2')).toBeInTheDocument();
  });

  it('sub_agentの折りたたみがデフォルトで閉じている', () => {
    const content = 'Main message';
    const subAgent = JSON.stringify({ name: 'Task Executor', output: 'Task completed successfully' });
    render(<MessageDisplay content={content} sub_agents={subAgent} />);

    // ボタンは表示される
    const button = screen.getByText('Sub-agent: Task Executor');
    expect(button).toBeInTheDocument();

    // 出力はデフォルトで非表示
    expect(screen.queryByText('Task completed successfully')).not.toBeInTheDocument();
  });

  it('sub_agentの折りたたみをクリックすると出力が表示される', () => {
    const content = 'Main message';
    const subAgent = JSON.stringify({ name: 'Task Executor', output: 'Task completed successfully' });
    render(<MessageDisplay content={content} sub_agents={subAgent} />);

    // 初期状態では出力は非表示
    expect(screen.queryByText('Task completed successfully')).not.toBeInTheDocument();

    // ボタンをクリック
    const button = screen.getByText('Sub-agent: Task Executor');
    fireEvent.click(button);

    // 出力が表示される
    expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
  });

  it('sub_agentの出力が改行を含む場合、正しく表示される', () => {
    const content = 'Main message';
    const subAgent = JSON.stringify({
      name: 'Multi-line Agent',
      output: 'Line 1\nLine 2\nLine 3',
    });
    const { container } = render(<MessageDisplay content={content} sub_agents={subAgent} />);

    // ボタンをクリックして展開
    const button = screen.getByText('Sub-agent: Multi-line Agent');
    fireEvent.click(button);

    // whitespace-pre-wrapクラスで改行が保持される
    const outputDiv = container.querySelector('.whitespace-pre-wrap');
    expect(outputDiv).toBeInTheDocument();
    expect(outputDiv?.textContent).toContain('Line 1');
    expect(outputDiv?.textContent).toContain('Line 2');
    expect(outputDiv?.textContent).toContain('Line 3');
  });
});
