import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardProgressBar } from '../WizardProgressBar';
import type { WizardStep } from '../types';
import { Server, Key, GitBranch, Play } from 'lucide-react';

const mockSteps: WizardStep[] = [
  { id: 1, label: '環境', icon: Server },
  { id: 2, label: '認証', icon: Key },
  { id: 3, label: 'リポジトリ', icon: GitBranch },
  { id: 4, label: 'セッション', icon: Play },
];

describe('WizardProgressBar', () => {
  it('4つのステップラベルが表示される', () => {
    render(
      <WizardProgressBar steps={mockSteps} currentStep={1} onStepClick={vi.fn()} />
    );

    expect(screen.getByText('環境')).toBeInTheDocument();
    expect(screen.getByText('認証')).toBeInTheDocument();
    expect(screen.getByText('リポジトリ')).toBeInTheDocument();
    expect(screen.getByText('セッション')).toBeInTheDocument();
  });

  it('現在のステップがハイライトされる', () => {
    render(
      <WizardProgressBar steps={mockSteps} currentStep={2} onStepClick={vi.fn()} />
    );

    const currentStepElement = screen.getByText('認証').closest('[data-step]');
    expect(currentStepElement).toHaveAttribute('data-status', 'current');
  });

  it('完了済みステップに完了状態が設定される', () => {
    render(
      <WizardProgressBar steps={mockSteps} currentStep={3} onStepClick={vi.fn()} />
    );

    const step1 = screen.getByText('環境').closest('[data-step]');
    const step2 = screen.getByText('認証').closest('[data-step]');
    expect(step1).toHaveAttribute('data-status', 'completed');
    expect(step2).toHaveAttribute('data-status', 'completed');
  });

  it('未完了ステップにpending状態が設定される', () => {
    render(
      <WizardProgressBar steps={mockSteps} currentStep={1} onStepClick={vi.fn()} />
    );

    const step3 = screen.getByText('リポジトリ').closest('[data-step]');
    const step4 = screen.getByText('セッション').closest('[data-step]');
    expect(step3).toHaveAttribute('data-status', 'pending');
    expect(step4).toHaveAttribute('data-status', 'pending');
  });

  it('完了済みステップクリックでonStepClickが呼ばれる', () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgressBar steps={mockSteps} currentStep={3} onStepClick={onStepClick} />
    );

    const step1 = screen.getByText('環境').closest('[data-step]');
    fireEvent.click(step1!);
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('未完了ステップクリックでonStepClickが呼ばれない', () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgressBar steps={mockSteps} currentStep={1} onStepClick={onStepClick} />
    );

    const step3 = screen.getByText('リポジトリ').closest('[data-step]');
    fireEvent.click(step3!);
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('現在のステップクリックでonStepClickが呼ばれない', () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgressBar steps={mockSteps} currentStep={2} onStepClick={onStepClick} />
    );

    const step2 = screen.getByText('認証').closest('[data-step]');
    fireEvent.click(step2!);
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('ステップ間にコネクターラインが表示される', () => {
    const { container } = render(
      <WizardProgressBar steps={mockSteps} currentStep={1} onStepClick={vi.fn()} />
    );

    const connectors = container.querySelectorAll('[data-connector]');
    expect(connectors).toHaveLength(3); // 4ステップ間に3つのコネクター
  });
});
