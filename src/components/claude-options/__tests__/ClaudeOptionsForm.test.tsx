import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClaudeOptionsForm } from '../ClaudeOptionsForm';
import type { ClaudeCodeOptions, CustomEnvVars } from '@/services/claude-options-service';

function createDefaultProps(overrides: Partial<Parameters<typeof ClaudeOptionsForm>[0]> = {}) {
  return {
    options: { model: '', allowedTools: '', permissionMode: '', additionalFlags: '' } as ClaudeCodeOptions,
    envVars: {} as CustomEnvVars,
    onOptionsChange: vi.fn(),
    onEnvVarsChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Headless UI Disclosureはデフォルトで閉じている場合があるため、
 * パネルを開くヘルパー
 */
async function openDisclosure() {
  const button = screen.getByText('Claude Code オプション（詳細設定）');
  fireEvent.click(button);
}

describe('ClaudeOptionsForm', () => {
  describe('基本動作', () => {
    it('フォームが表示される', async () => {
      const props = createDefaultProps();
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      expect(screen.getByText('モデル')).toBeInTheDocument();
      expect(screen.getByText('許可ツール')).toBeInTheDocument();
      expect(screen.getByText('権限モード')).toBeInTheDocument();
      expect(screen.getByText('追加フラグ')).toBeInTheDocument();
    });

    it('オプション変更時にonOptionsChangeが呼ばれる', async () => {
      const onOptionsChange = vi.fn();
      const props = createDefaultProps({ onOptionsChange });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const modelInput = screen.getByPlaceholderText('例: claude-sonnet-4-5-20250929');
      fireEvent.change(modelInput, { target: { value: 'claude-sonnet-4-5-20250929' } });

      expect(onOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5-20250929' })
      );
    });
  });

  describe('disabledBySkipPermissions', () => {
    it('未指定の場合、permissionModeとallowedToolsはenabledである', async () => {
      const props = createDefaultProps();
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const allowedToolsInput = screen.getByPlaceholderText('例: Bash,Read,Write');
      const permissionModeSelect = screen.getByDisplayValue('指定なし');

      expect(allowedToolsInput).not.toBeDisabled();
      expect(permissionModeSelect).not.toBeDisabled();
    });

    it('falseの場合、permissionModeとallowedToolsはenabledである', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: false });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const allowedToolsInput = screen.getByPlaceholderText('例: Bash,Read,Write');
      const permissionModeSelect = screen.getByDisplayValue('指定なし');

      expect(allowedToolsInput).not.toBeDisabled();
      expect(permissionModeSelect).not.toBeDisabled();
    });

    it('trueの場合、permissionModeとallowedToolsがdisabledになる', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: true });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const allowedToolsInput = screen.getByPlaceholderText('例: Bash,Read,Write');
      const permissionModeSelect = screen.getByDisplayValue('指定なし');

      expect(allowedToolsInput).toBeDisabled();
      expect(permissionModeSelect).toBeDisabled();
    });

    it('trueの場合、disabledフィールドに説明メッセージが表示される', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: true });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const messages = screen.getAllByText('パーミッション確認スキップが有効なため、この設定は無視されます');
      expect(messages).toHaveLength(2); // allowedTools + permissionMode
    });

    it('trueの場合、additionalFlagsに警告メッセージが表示される', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: true });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      expect(
        screen.getByText('権限関連フラグ（--permission-mode, --allowedTools）は無視されます')
      ).toBeInTheDocument();
    });

    it('trueの場合、additionalFlags自体はdisabledにならない', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: true });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const additionalFlagsInput = screen.getByPlaceholderText('例: --verbose --max-turns 10');
      expect(additionalFlagsInput).not.toBeDisabled();
    });

    it('falseの場合、説明メッセージと警告メッセージは表示されない', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: false });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      expect(
        screen.queryByText('パーミッション確認スキップが有効なため、この設定は無視されます')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('権限関連フラグ（--permission-mode, --allowedTools）は無視されます')
      ).not.toBeInTheDocument();
    });

    it('disabled中もフィールドの値は保持される', async () => {
      const options = {
        model: 'test-model',
        allowedTools: 'Bash,Read',
        permissionMode: 'plan',
        additionalFlags: '--verbose',
      } as ClaudeCodeOptions;

      const props = createDefaultProps({
        options,
        disabledBySkipPermissions: true,
      });
      // hasAnySettings=trueになるため、Disclosureはデフォルトで開いている
      render(<ClaudeOptionsForm {...props} />);

      const allowedToolsInput = screen.getByPlaceholderText('例: Bash,Read,Write');
      const permissionModeSelect = screen.getByDisplayValue('plan');

      expect(allowedToolsInput).toHaveValue('Bash,Read');
      expect(permissionModeSelect).toHaveValue('plan');
      expect(allowedToolsInput).toBeDisabled();
      expect(permissionModeSelect).toBeDisabled();
    });

    it('trueの場合、モデルフィールドはdisabledにならない', async () => {
      const props = createDefaultProps({ disabledBySkipPermissions: true });
      render(<ClaudeOptionsForm {...props} />);

      await openDisclosure();

      const modelInput = screen.getByPlaceholderText('例: claude-sonnet-4-5-20250929');
      expect(modelInput).not.toBeDisabled();
    });
  });
});
