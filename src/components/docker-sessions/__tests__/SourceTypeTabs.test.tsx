import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceTypeTabs } from '../SourceTypeTabs';

describe('SourceTypeTabs', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should display "Remote" tab as selected when value is "remote"', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });
      const localTab = screen.getByRole('tab', { name: /local/i });

      expect(remoteTab).toHaveAttribute('aria-selected', 'true');
      expect(localTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should display "Local" tab as selected when value is "local"', () => {
      render(
        <SourceTypeTabs value="local" onChange={mockOnChange} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });
      const localTab = screen.getByRole('tab', { name: /local/i });

      expect(remoteTab).toHaveAttribute('aria-selected', 'false');
      expect(localTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('tab switching', () => {
    it('should call onChange with "local" when Local tab is clicked', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      const localTab = screen.getByRole('tab', { name: /local/i });
      fireEvent.click(localTab);

      expect(mockOnChange).toHaveBeenCalledWith('local');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with "remote" when Remote tab is clicked', () => {
      render(
        <SourceTypeTabs value="local" onChange={mockOnChange} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });
      fireEvent.click(remoteTab);

      expect(mockOnChange).toHaveBeenCalledWith('remote');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('should not call onChange when clicking already selected tab', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });
      fireEvent.click(remoteTab);

      // Headless UI TabGroup does not call onChange when clicking the already selected tab
      // if we implement controlled mode correctly
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should not call onChange when disabled', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} disabled={true} />
      );

      const localTab = screen.getByRole('tab', { name: /local/i });
      fireEvent.click(localTab);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should have aria-disabled attribute on tabs when disabled', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} disabled={true} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });
      const localTab = screen.getByRole('tab', { name: /local/i });

      expect(remoteTab).toHaveAttribute('aria-disabled', 'true');
      expect(localTab).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('accessibility', () => {
    it('should have tablist role on the tab container', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have tab role on each tab', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
    });

    it('should support keyboard navigation', () => {
      render(
        <SourceTypeTabs value="remote" onChange={mockOnChange} />
      );

      const remoteTab = screen.getByRole('tab', { name: /remote/i });

      // Focus the first tab
      remoteTab.focus();
      expect(document.activeElement).toBe(remoteTab);

      // Press ArrowRight to move to next tab
      fireEvent.keyDown(remoteTab, { key: 'ArrowRight' });

      const localTab = screen.getByRole('tab', { name: /local/i });
      expect(document.activeElement).toBe(localTab);
    });
  });
});
