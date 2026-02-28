import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PortMappingList } from '../PortMappingList';
import type { PortMapping } from '@/types/environment';

describe('PortMappingList', () => {
  const defaultProps = {
    value: [] as PortMapping[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('empty state', () => {
    it('should display empty message and add button when value is empty', () => {
      render(<PortMappingList {...defaultProps} />);

      expect(screen.getByText('ポートマッピングは設定されていません')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ポートを追加/ })).toBeInTheDocument();
    });
  });

  describe('adding port mapping', () => {
    it('should call onChange with new mapping when add button is clicked', () => {
      const onChange = vi.fn();
      render(<PortMappingList value={[]} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /ポートを追加/ }));

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 0, containerPort: 0, protocol: 'tcp' },
      ]);
    });

    it('should append to existing mappings when add button is clicked', () => {
      const existing: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      render(<PortMappingList value={existing} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /ポートを追加/ }));

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 0, containerPort: 0, protocol: 'tcp' },
      ]);
    });
  });

  describe('removing port mapping', () => {
    it('should call onChange without the removed mapping when delete button is clicked', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      render(<PortMappingList value={mappings} onChange={onChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
      fireEvent.click(deleteButtons[0]);

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
      ]);
    });
  });

  describe('editing port mapping', () => {
    it('should call onChange with updated hostPort when input changes', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      render(<PortMappingList value={mappings} onChange={onChange} />);

      const hostPortInputs = screen.getAllByPlaceholderText('ホストポート');
      fireEvent.change(hostPortInputs[0], { target: { value: '9090' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 9090, containerPort: 80, protocol: 'tcp' },
      ]);
    });

    it('should call onChange with updated containerPort when input changes', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      render(<PortMappingList value={mappings} onChange={onChange} />);

      const containerPortInputs = screen.getAllByPlaceholderText('コンテナポート');
      fireEvent.change(containerPortInputs[0], { target: { value: '443' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 8080, containerPort: 443, protocol: 'tcp' },
      ]);
    });

    it('should call onChange with updated protocol when select changes', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      render(<PortMappingList value={mappings} onChange={onChange} />);

      const protocolSelects = screen.getAllByDisplayValue('tcp');
      fireEvent.change(protocolSelects[0], { target: { value: 'udp' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPort: 8080, containerPort: 80, protocol: 'udp' },
      ]);
    });
  });

  describe('default protocol', () => {
    it('should default protocol to tcp for new mappings', () => {
      const onChange = vi.fn();
      render(<PortMappingList value={[]} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /ポートを追加/ }));

      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ protocol: 'tcp' }),
      ]);
    });
  });

  describe('validation errors', () => {
    it('should display error for invalid port number (out of range)', () => {
      const mappings: PortMapping[] = [
        { hostPort: 99999, containerPort: 80, protocol: 'tcp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      expect(screen.getByText(/hostPortは1から65535の範囲である必要があります/)).toBeInTheDocument();
    });

    it('should display error for duplicate host port and protocol', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 443, protocol: 'tcp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      expect(screen.getByText(/hostPort 8080\/tcp が重複しています/)).toBeInTheDocument();
    });

    it('should not display errors for valid mappings', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      expect(screen.queryByText(/エラー/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/範囲/)).not.toBeInTheDocument();
      expect(screen.queryByText(/重複/)).not.toBeInTheDocument();
    });
  });

  describe('rendering with mappings', () => {
    it('should render section title', () => {
      render(<PortMappingList {...defaultProps} />);

      expect(screen.getByText('ポートマッピング')).toBeInTheDocument();
    });

    it('should render input rows for each mapping', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 3000, containerPort: 3000, protocol: 'udp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      const hostPortInputs = screen.getAllByPlaceholderText('ホストポート');
      const containerPortInputs = screen.getAllByPlaceholderText('コンテナポート');

      expect(hostPortInputs).toHaveLength(2);
      expect(containerPortInputs).toHaveLength(2);
    });

    it('should not display empty message when mappings exist', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      expect(screen.queryByText('ポートマッピングは設定されていません')).not.toBeInTheDocument();
    });
  });

  describe('port check button', () => {
    it('should display port check button when valid ports exist', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      render(<PortMappingList value={mappings} onChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: /ポートチェック/ })).toBeInTheDocument();
    });

    it('should not display port check button when no ports exist', () => {
      render(<PortMappingList value={[]} onChange={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /ポートチェック/ })).not.toBeInTheDocument();
    });

    it('should call fetch API when check button is clicked', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/environments/check-ports', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('should display available text when port check result is available', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ port: 8080, status: 'available' }],
        }),
      } as Response);

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('利用可能')).toBeInTheDocument();
      });
    });

    it('should display in_use text when port check result is in_use', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ port: 8080, status: 'in_use', usedBy: 'nginx' }],
        }),
      } as Response);

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText(/使用中/)).toBeInTheDocument();
      });
    });

    it('should display unknown text when port check result is unknown', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ port: 8080, status: 'unknown' }],
        }),
      } as Response);

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('チェック不可')).toBeInTheDocument();
      });
    });

    it('should reset port check results when host port changes', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      const onChange = vi.fn();
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ port: 8080, status: 'available' }],
        }),
      } as Response);

      const { rerender } = render(<PortMappingList value={mappings} onChange={onChange} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('利用可能')).toBeInTheDocument();
      });

      // ホストポートを変更してrerenderする
      const hostPortInputs = screen.getAllByPlaceholderText('ホストポート');
      fireEvent.change(hostPortInputs[0], { target: { value: '9090' } });

      const updatedMappings: PortMapping[] = [
        { hostPort: 9090, containerPort: 80, protocol: 'tcp' },
      ];
      rerender(<PortMappingList value={updatedMappings} onChange={onChange} />);

      expect(screen.queryByText('利用可能')).not.toBeInTheDocument();
    });

    it('should show unknown results when fetch fails', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('チェック不可')).toBeInTheDocument();
      });
    });

    it('should show unknown results when response is not ok', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      render(<PortMappingList value={mappings} onChange={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('チェック不可')).toBeInTheDocument();
      });
    });

    it('should include excludeEnvironmentId in fetch request', async () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);

      render(
        <PortMappingList
          value={mappings}
          onChange={vi.fn()}
          excludeEnvironmentId="env-123"
        />
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /ポートチェック/ }));
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall[0]).toBe('/api/environments/check-ports');
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string);
      expect(body).toEqual({
        ports: [8080],
        excludeEnvironmentId: 'env-123',
      });
    });
  });
});
