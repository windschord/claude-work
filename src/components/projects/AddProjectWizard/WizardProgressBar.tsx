'use client';

import { Fragment } from 'react';
import { Check } from 'lucide-react';
import type { WizardStep } from './types';

interface WizardProgressBarProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

function getStepStatus(stepId: number, currentStep: number): 'completed' | 'current' | 'pending' {
  if (stepId < currentStep) return 'completed';
  if (stepId === currentStep) return 'current';
  return 'pending';
}

export function WizardProgressBar({ steps, currentStep, onStepClick }: WizardProgressBarProps) {
  const handleClick = (stepId: number, status: string) => {
    if (status === 'completed') {
      onStepClick(stepId);
    }
  };

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id, currentStep);
        const Icon = step.icon;

        return (
          <Fragment key={step.id}>
            <div
              data-step={step.id}
              data-status={status}
              className={`flex flex-col items-center gap-1 ${
                status === 'completed' ? 'cursor-pointer' : ''
              }`}
              onClick={() => handleClick(step.id, status)}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  status === 'completed'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : status === 'current'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}
              >
                {status === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-xs transition-colors ${
                  status === 'current'
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                data-connector
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  step.id < currentStep
                    ? 'bg-green-300 dark:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
