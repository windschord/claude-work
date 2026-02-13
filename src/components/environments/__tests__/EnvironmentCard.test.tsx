import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnvironmentCard } from '../EnvironmentCard';
import { Environment } from '@/hooks/useEnvironments';

describe('EnvironmentCard', () => {
  const defaultProps = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  const createEnvironment = (overrides: Partial<Environment> = {}): Environment => ({
    id: 'env-1',
    name: 'Test Environment',
    type: 'HOST',
    description: 'Test description',
    config: '{}',
    is_default: false,
    status: {
      available: true,
      authenticated: true,
    },
    ...overrides,
  });

  describe('Docker image info display', () => {
    it('should not display image info for HOST environment', () => {
      const environment = createEnvironment({
        type: 'HOST',
        config: JSON.stringify({ imageName: 'test-image' }),
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.queryByText(/イメージ:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dockerfile:/)).not.toBeInTheDocument();
    });

    it('should not display image info for SSH environment', () => {
      const environment = createEnvironment({
        type: 'SSH',
        config: JSON.stringify({ imageName: 'test-image' }),
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.queryByText(/イメージ:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dockerfile:/)).not.toBeInTheDocument();
    });

    it('should display Dockerfile upload status when imageSource is "dockerfile"', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: JSON.stringify({
          imageSource: 'dockerfile',
          dockerfileUploaded: true,
        }),
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText('Dockerfile:')).toBeInTheDocument();
      expect(screen.getByText('アップロード済み')).toBeInTheDocument();
    });

    it('should display image name and tag when imageSource is "existing"', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: JSON.stringify({
          imageSource: 'existing',
          imageName: 'my-custom-image',
          imageTag: 'v1.0.0',
        }),
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('my-custom-image:v1.0.0')).toBeInTheDocument();
    });

    it('should display default image name when not specified for existing imageSource', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: JSON.stringify({
          imageSource: 'existing',
        }),
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('claude-code-sandboxed:latest')).toBeInTheDocument();
    });

    it('should display default image info when imageSource is not specified', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: '{}',
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('claude-code-sandboxed:latest')).toBeInTheDocument();
    });

    it('should handle config as object (not string)', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: {
          imageSource: 'existing',
          imageName: 'object-config-image',
          imageTag: 'v2.0.0',
        } as unknown as string,
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('object-config-image:v2.0.0')).toBeInTheDocument();
    });

    it('should handle empty config gracefully', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: '',
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      // Should still render with default values
      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('claude-code-sandboxed:latest')).toBeInTheDocument();
    });

    it('should handle null config gracefully', () => {
      const environment = createEnvironment({
        type: 'DOCKER',
        config: null as unknown as string,
      });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      // Should still render with default values
      expect(screen.getByText(/イメージ:/)).toBeInTheDocument();
      expect(screen.getByText('claude-code-sandboxed:latest')).toBeInTheDocument();
    });
  });

  describe('basic rendering', () => {
    it('should render environment name', () => {
      const environment = createEnvironment({ name: 'My Environment' });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText('My Environment')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      const environment = createEnvironment({ description: 'This is a test' });

      render(<EnvironmentCard {...defaultProps} environment={environment} />);

      expect(screen.getByText('This is a test')).toBeInTheDocument();
    });
  });
});
