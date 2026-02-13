import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { CloneErrorMessage } from '../CloneErrorMessage';

describe('CloneErrorMessage', () => {
  afterEach(() => {
    cleanup();
  });

  it('エラーメッセージが表示される', () => {
    render(<CloneErrorMessage errorMessage="Clone operation failed" />);

    expect(screen.getByText('Clone operation failed')).toBeInTheDocument();
  });

  it('401エラー時に認証失敗メッセージが表示される', () => {
    render(
      <CloneErrorMessage
        errorCode="401"
        errorMessage="GitHub authentication failed"
      />
    );

    expect(
      screen.getByText('GitHub認証に失敗しました。PATが有効か確認してください。')
    ).toBeInTheDocument();
  });

  it('401エラー時にPAT設定画面へのリンクが表示される', () => {
    render(
      <CloneErrorMessage
        errorCode="401"
        errorMessage="GitHub authentication failed"
      />
    );

    const link = screen.getByRole('link', { name: /PAT設定/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/settings/github-pat');
  });

  it('401以外のエラー時はエラーメッセージをそのまま表示する', () => {
    render(
      <CloneErrorMessage
        errorCode="500"
        errorMessage="Internal server error"
      />
    );

    expect(screen.getByText('Internal server error')).toBeInTheDocument();
  });

  it('401以外のエラー時はPAT設定リンクが表示されない', () => {
    render(
      <CloneErrorMessage
        errorCode="500"
        errorMessage="Internal server error"
      />
    );

    expect(screen.queryByRole('link', { name: /PAT設定/ })).not.toBeInTheDocument();
  });

  it('errorCodeが未指定の場合はエラーメッセージをそのまま表示する', () => {
    render(<CloneErrorMessage errorMessage="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /PAT設定/ })).not.toBeInTheDocument();
  });

  it('エラーアイコンが表示される', () => {
    render(<CloneErrorMessage errorMessage="Error" />);

    expect(screen.getByTestId('clone-error-icon')).toBeInTheDocument();
  });

  it('エラーコンテナが適切なロールを持つ', () => {
    render(<CloneErrorMessage errorMessage="Error" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
