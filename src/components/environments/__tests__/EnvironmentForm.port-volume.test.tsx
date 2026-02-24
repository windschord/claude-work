import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EnvironmentForm } from '../EnvironmentForm';
import { Environment, CreateEnvironmentInput, UpdateEnvironmentInput } from '@/hooks/useEnvironments';

// fetch をモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Docker images APIのモックレスポンスを設定する
 */
function mockDockerImagesApi(images: Array<{ repository: string; tag: string; id: string; size: string; created: string }> = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/docker/images') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ images }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

/**
 * EnvironmentFormのデフォルトpropsを生成する
 */
function createDefaultProps(overrides: Partial<Parameters<typeof EnvironmentForm>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn<(input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<Environment | void>>().mockResolvedValue(undefined),
    mode: 'create' as const,
    ...overrides,
  };
}

/**
 * テスト用の編集モード環境オブジェクトを生成する
 */
function createDockerEnvironment(configOverrides: object = {}): Environment {
  return {
    id: 'env-1',
    name: 'Test Docker',
    type: 'DOCKER',
    config: JSON.stringify({
      imageSource: 'existing',
      imageName: 'test-image',
      imageTag: 'latest',
      skipPermissions: false,
      portMappings: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
      volumeMounts: [{ hostPath: '/data', containerPath: '/app/data', accessMode: 'rw' }],
      ...configOverrides,
    }),
    is_default: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };
}

/**
 * タイプ選択でDOCKERを選択するヘルパー
 * HeadlessUI Listboxはクリックでオプション一覧を開き、オプションをクリックして選択する
 */
async function selectDockerType() {
  // タイプのListboxボタンをクリックしてオプション一覧を開く
  const typeButton = screen.getByRole('button', { name: /ホスト/ });
  fireEvent.click(typeButton);

  // Dockerオプションを選択
  const dockerOption = await screen.findByText('Docker');
  fireEvent.click(dockerOption);
}

describe('EnvironmentForm - PortMapping/VolumeMount integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDockerImagesApi();
  });

  describe('Docker環境作成フォーム - セクション表示', () => {
    it('Docker環境作成フォームにポートマッピングセクションが表示される', async () => {
      const props = createDefaultProps();
      render(<EnvironmentForm {...props} />);

      await selectDockerType();

      // Docker images API呼び出しの完了を待つ
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      expect(screen.getByText('ポートマッピング')).toBeInTheDocument();
    });

    it('Docker環境作成フォームにボリュームマウントセクションが表示される', async () => {
      const props = createDefaultProps();
      render(<EnvironmentForm {...props} />);

      await selectDockerType();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      expect(screen.getByText('ボリュームマウント')).toBeInTheDocument();
    });
  });

  describe('フォーム送信時のconfig内容', () => {
    it('ポートマッピングを追加してフォーム送信するとconfigにportMappingsが含まれる', async () => {
      const onSubmit = vi.fn<(input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<Environment | void>>().mockResolvedValue(undefined);
      const props = createDefaultProps({ onSubmit });
      render(<EnvironmentForm {...props} />);

      // 環境名を入力
      const nameInput = screen.getByPlaceholderText('例: Docker Dev');
      fireEvent.change(nameInput, { target: { value: 'Test Docker Env' } });

      // DOCKERタイプを選択
      await selectDockerType();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      // ポートを追加ボタンをクリック
      const addPortButton = screen.getByRole('button', { name: /ポートを追加/ });
      fireEvent.click(addPortButton);

      // ホストポートを入力
      const hostPortInput = screen.getByPlaceholderText('ホストポート');
      fireEvent.change(hostPortInput, { target: { value: '8080' } });

      // コンテナポートを入力
      const containerPortInput = screen.getByPlaceholderText('コンテナポート');
      fireEvent.change(containerPortInput, { target: { value: '80' } });

      // フォーム送信
      const submitButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submitArg = onSubmit.mock.calls[0][0] as CreateEnvironmentInput;
      expect(submitArg.config).toBeDefined();
      expect((submitArg.config as Record<string, unknown>).portMappings).toEqual([
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ]);
    });

    it('ボリュームマウントを追加してフォーム送信するとconfigにvolumeMountsが含まれる', async () => {
      const onSubmit = vi.fn<(input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<Environment | void>>().mockResolvedValue(undefined);
      const props = createDefaultProps({ onSubmit });
      render(<EnvironmentForm {...props} />);

      // 環境名を入力
      const nameInput = screen.getByPlaceholderText('例: Docker Dev');
      fireEvent.change(nameInput, { target: { value: 'Test Docker Env' } });

      // DOCKERタイプを選択
      await selectDockerType();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      // ボリュームを追加ボタンをクリック
      fireEvent.click(screen.getByText('ボリュームを追加'));

      // ホストパスを入力
      const hostPathInput = screen.getByPlaceholderText('/host/path');
      fireEvent.change(hostPathInput, { target: { value: '/data' } });

      // コンテナパスを入力
      const containerPathInput = screen.getByPlaceholderText('/container/path');
      fireEvent.change(containerPathInput, { target: { value: '/app/data' } });

      // フォーム送信
      const submitButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submitArg = onSubmit.mock.calls[0][0] as CreateEnvironmentInput;
      expect(submitArg.config).toBeDefined();
      expect((submitArg.config as Record<string, unknown>).volumeMounts).toEqual([
        { hostPath: '/data', containerPath: '/app/data', accessMode: 'rw' },
      ]);
    });
  });

  describe('編集モードでの復元', () => {
    it('編集モードでportMappings/volumeMountsが復元される', async () => {
      const environment = createDockerEnvironment();
      const props = createDefaultProps({
        mode: 'edit',
        environment,
      });
      render(<EnvironmentForm {...props} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      // ポートマッピングが復元されている
      const hostPortInputs = screen.getAllByPlaceholderText('ホストポート');
      expect(hostPortInputs).toHaveLength(1);
      expect(hostPortInputs[0]).toHaveValue(8080);

      const containerPortInputs = screen.getAllByPlaceholderText('コンテナポート');
      expect(containerPortInputs).toHaveLength(1);
      expect(containerPortInputs[0]).toHaveValue(80);

      // ボリュームマウントが復元されている
      const hostPathInputs = screen.getAllByPlaceholderText('/host/path');
      expect(hostPathInputs).toHaveLength(1);
      expect(hostPathInputs[0]).toHaveValue('/data');

      const containerPathInputs = screen.getAllByPlaceholderText('/container/path');
      expect(containerPathInputs).toHaveLength(1);
      expect(containerPathInputs[0]).toHaveValue('/app/data');
    });
  });

  describe('DangerousPathWarning', () => {
    it('危険パスを入力するとDangerousPathWarning警告ダイアログが表示される', async () => {
      const props = createDefaultProps();
      render(<EnvironmentForm {...props} />);

      // DOCKERタイプを選択
      await selectDockerType();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      // ボリュームを追加
      fireEvent.click(screen.getByText('ボリュームを追加'));

      // 危険なホストパスを入力してフォーカスを外す
      const hostPathInput = screen.getByPlaceholderText('/host/path');
      fireEvent.change(hostPathInput, { target: { value: '/etc' } });
      fireEvent.blur(hostPathInput);

      // DangerousPathWarning ダイアログが表示される
      await waitFor(() => {
        expect(screen.getByText('セキュリティ警告')).toBeInTheDocument();
      });
      expect(screen.getByText(/以下のパスはシステムディレクトリです/)).toBeInTheDocument();
      expect(screen.getByText('/etc')).toBeInTheDocument();
    });

    it('DangerousPathWarningでキャンセルするとパスがクリアされる', async () => {
      const props = createDefaultProps();
      render(<EnvironmentForm {...props} />);

      // DOCKERタイプを選択
      await selectDockerType();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/docker/images');
      });

      // ボリュームを追加
      fireEvent.click(screen.getByText('ボリュームを追加'));

      // 危険なホストパスを入力してフォーカスを外す
      const hostPathInput = screen.getByPlaceholderText('/host/path');
      fireEvent.change(hostPathInput, { target: { value: '/etc' } });
      fireEvent.blur(hostPathInput);

      // ダイアログが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByText('セキュリティ警告')).toBeInTheDocument();
      });

      // キャンセルボタンをクリック
      // DangerousPathWarningダイアログ内のキャンセルボタンを取得
      const dialogs = screen.getAllByRole('dialog');
      const dangerousPathDialog = dialogs[dialogs.length - 1];
      const cancelButton = within(dangerousPathDialog).getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      // パスがクリアされる（マウントが削除されるか、パスが空になる）
      await waitFor(() => {
        expect(screen.queryByText('セキュリティ警告')).not.toBeInTheDocument();
      });

      // 入力がクリアされていることを確認
      const hostPathInputAfter = screen.queryByPlaceholderText('/host/path');
      if (hostPathInputAfter) {
        expect(hostPathInputAfter).toHaveValue('');
      } else {
        // マウントが削除された場合
        expect(screen.getByText('ボリュームマウントは設定されていません')).toBeInTheDocument();
      }
    });
  });

  describe('HOST環境での非表示', () => {
    it('HOST環境ではポートマッピング・ボリュームマウントセクションが表示されない', () => {
      const props = createDefaultProps();
      render(<EnvironmentForm {...props} />);

      // デフォルトはHOSTタイプ
      expect(screen.queryByText('ポートマッピング')).not.toBeInTheDocument();
      expect(screen.queryByText('ボリュームマウント')).not.toBeInTheDocument();
    });
  });
});
