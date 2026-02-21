import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeMountList } from '../VolumeMountList';
import type { VolumeMount } from '@/types/environment';

describe('VolumeMountList', () => {
  const defaultProps = {
    value: [] as VolumeMount[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should display empty message and add button when no mounts', () => {
      render(<VolumeMountList {...defaultProps} />);

      expect(screen.getByText('ボリュームマウントは設定されていません')).toBeInTheDocument();
      expect(screen.getByText('ボリュームを追加')).toBeInTheDocument();
    });
  });

  describe('adding mount', () => {
    it('should call onChange with new mount when add button is clicked', () => {
      const onChange = vi.fn();
      render(<VolumeMountList value={[]} onChange={onChange} />);

      fireEvent.click(screen.getByText('ボリュームを追加'));

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '', containerPath: '', accessMode: 'rw' },
      ]);
    });

    it('should add mount to existing list', () => {
      const existing: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'ro' },
      ];
      const onChange = vi.fn();
      render(<VolumeMountList value={existing} onChange={onChange} />);

      fireEvent.click(screen.getByText('ボリュームを追加'));

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'ro' },
        { hostPath: '', containerPath: '', accessMode: 'rw' },
      ]);
    });
  });

  describe('removing mount', () => {
    it('should call onChange without removed mount when delete button is clicked', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
        { hostPath: '/logs', containerPath: '/mnt/logs', accessMode: 'ro' },
      ];
      const onChange = vi.fn();
      render(<VolumeMountList value={mounts} onChange={onChange} />);

      // Click the first delete button
      const deleteButtons = screen.getAllByRole('button', { name: '削除' });
      fireEvent.click(deleteButtons[0]);

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '/logs', containerPath: '/mnt/logs', accessMode: 'ro' },
      ]);
    });
  });

  describe('editing mount', () => {
    it('should update hostPath when input changes', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      const onChange = vi.fn();
      render(<VolumeMountList value={mounts} onChange={onChange} />);

      const hostPathInputs = screen.getAllByPlaceholderText('/host/path');
      fireEvent.change(hostPathInputs[0], { target: { value: '/new/data' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '/new/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ]);
    });

    it('should update containerPath when input changes', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      const onChange = vi.fn();
      render(<VolumeMountList value={mounts} onChange={onChange} />);

      const containerPathInputs = screen.getAllByPlaceholderText('/container/path');
      fireEvent.change(containerPathInputs[0], { target: { value: '/mnt/new' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '/data', containerPath: '/mnt/new', accessMode: 'rw' },
      ]);
    });

    it('should update accessMode when select changes', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      const onChange = vi.fn();
      render(<VolumeMountList value={mounts} onChange={onChange} />);

      const selects = screen.getAllByDisplayValue('RW');
      fireEvent.change(selects[0], { target: { value: 'ro' } });

      expect(onChange).toHaveBeenCalledWith([
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'ro' },
      ]);
    });
  });

  describe('default access mode', () => {
    it('should default to rw when adding a new mount', () => {
      const onChange = vi.fn();
      render(<VolumeMountList value={[]} onChange={onChange} />);

      fireEvent.click(screen.getByText('ボリュームを追加'));

      const newMount = onChange.mock.calls[0][0][0];
      expect(newMount.accessMode).toBe('rw');
    });
  });

  describe('validation errors', () => {
    it('should show error for non-absolute hostPath', () => {
      const mounts: VolumeMount[] = [
        { hostPath: 'relative/path', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText('hostPathは絶対パスである必要があります')).toBeInTheDocument();
    });

    it('should show error for non-absolute containerPath', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: 'relative/path', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText('containerPathは絶対パスである必要があります')).toBeInTheDocument();
    });

    it('should show error for system container path', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/workspace', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText(/システムが使用するパスのためマウントできません/)).toBeInTheDocument();
    });

    it('should show error for system container subpath', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/home/node/.claude/config', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText(/システムが使用するパスのためマウントできません/)).toBeInTheDocument();
    });

    it('should not show error for valid paths', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.queryByText(/絶対パス/)).not.toBeInTheDocument();
      expect(screen.queryByText(/システムが使用するパス/)).not.toBeInTheDocument();
    });

    it('should not show error for empty paths (not yet entered)', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '', containerPath: '', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.queryByText(/絶対パス/)).not.toBeInTheDocument();
      expect(screen.queryByText(/システムが使用するパス/)).not.toBeInTheDocument();
    });
  });

  describe('dangerous path warning', () => {
    it('should show warning for dangerous host path', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/etc', containerPath: '/mnt/etc', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText(/危険なシステムパスです/)).toBeInTheDocument();
    });

    it('should call onDangerousPath when dangerous path is detected', () => {
      const onDangerousPath = vi.fn();
      const mounts: VolumeMount[] = [
        { hostPath: '/etc/nginx', containerPath: '/mnt/etc', accessMode: 'rw' },
      ];
      render(
        <VolumeMountList
          value={mounts}
          onChange={vi.fn()}
          onDangerousPath={onDangerousPath}
        />
      );

      expect(onDangerousPath).toHaveBeenCalledWith('/etc/nginx');
    });

    it('should show warning for dangerous subpath', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/proc/cpuinfo', containerPath: '/mnt/cpu', accessMode: 'ro' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText(/危険なシステムパスです/)).toBeInTheDocument();
    });
  });

  describe('section title', () => {
    it('should display section title', () => {
      render(<VolumeMountList {...defaultProps} />);

      expect(screen.getByText('ボリュームマウント')).toBeInTheDocument();
    });
  });

  describe('rendering with existing mounts', () => {
    it('should render arrow separator between host and container paths', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      expect(screen.getByText('->')).toBeInTheDocument();
    });

    it('should render correct number of mount rows', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data', containerPath: '/mnt/data', accessMode: 'rw' },
        { hostPath: '/logs', containerPath: '/mnt/logs', accessMode: 'ro' },
        { hostPath: '/config', containerPath: '/mnt/config', accessMode: 'rw' },
      ];
      render(<VolumeMountList value={mounts} onChange={vi.fn()} />);

      const deleteButtons = screen.getAllByRole('button', { name: '削除' });
      expect(deleteButtons).toHaveLength(3);
    });
  });
});
