import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortMappingList } from '../PortMappingList';
import type { PortMapping } from '@/types/environment';

describe('PortMappingList', () => {
  const defaultProps = {
    value: [] as PortMapping[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
});
