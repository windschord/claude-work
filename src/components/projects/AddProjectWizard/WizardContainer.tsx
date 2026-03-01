'use client';

import { useState, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Server, Key, FolderGit2, Play } from 'lucide-react';
import { useAppStore } from '@/store';
import toast from 'react-hot-toast';

import { WizardProgressBar } from './WizardProgressBar';
import { StepEnvironment } from './StepEnvironment';
import { StepAuthentication } from './StepAuthentication';
import { StepRepository } from './StepRepository';
import { StepSession } from './StepSession';
import { initialWizardData } from './types';
import type { WizardData, WizardStep } from './types';

const WIZARD_STEPS: WizardStep[] = [
  { id: 1, label: '環境', icon: Server },
  { id: 2, label: '認証', icon: Key },
  { id: 3, label: 'リポジトリ', icon: FolderGit2 },
  { id: 4, label: 'セッション', icon: Play },
];

interface AddProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 4;

export function AddProjectWizard({ isOpen, onClose }: AddProjectWizardProps) {
  const { fetchProjects } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({ ...initialWizardData });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostEnvironmentDisabled, setHostEnvironmentDisabled] = useState(false);

  const handleDataChange = useCallback((data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setWizardData({ ...initialWizardData });
    setIsSubmitting(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return !!wizardData.environmentId;
      case 2:
        return true; // 認証はオプション
      case 3:
        if (wizardData.repoType === 'local') {
          return !!wizardData.localPath.trim();
        }
        return !!wizardData.remoteUrl.trim();
      default:
        return false;
    }
  }, [currentStep, wizardData]);

  const handleNext = useCallback(async () => {
    if (currentStep === 3) {
      // Step 3 の「次へ」でプロジェクト作成を実行
      setIsSubmitting(true);
      setError(null);

      try {
        let projectId: string;

        if (wizardData.repoType === 'local') {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: wizardData.localPath.trim(),
              name: wizardData.projectName || undefined,
              environment_id: wizardData.environmentId,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'プロジェクトの追加に失敗しました');
          }
          projectId = data.project.id;
        } else {
          const response = await fetch('/api/projects/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: wizardData.remoteUrl.trim(),
              targetDir: wizardData.targetDir.trim() || undefined,
              cloneLocation: wizardData.cloneLocation,
              githubPatId: wizardData.githubPatId || undefined,
              environment_id: wizardData.environmentId,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'リポジトリのcloneに失敗しました');
          }
          projectId = data.project.id;
        }

        await fetchProjects();
        handleDataChange({ createdProjectId: projectId });
        toast.success('プロジェクトを追加しました');
        setCurrentStep(4);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'プロジェクトの追加に失敗しました';
        setError(errorMessage);
        setCurrentStep(4);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, wizardData, fetchProjects, handleDataChange]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  }, [currentStep]);

  const handleRetry = useCallback(() => {
    setError(null);
    setCurrentStep(3);
  }, []);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                  >
                    プロジェクトを追加
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <WizardProgressBar
                  steps={WIZARD_STEPS}
                  currentStep={currentStep}
                  onStepClick={handleStepClick}
                />

                <div className="mt-6 min-h-[300px]">
                  {currentStep === 1 && (
                    <StepEnvironment
                      environmentId={wizardData.environmentId}
                      onChange={handleDataChange}
                      onHostEnvironmentDisabledChange={setHostEnvironmentDisabled}
                    />
                  )}
                  {currentStep === 2 && (
                    <StepAuthentication
                      githubPatId={wizardData.githubPatId}
                      onChange={handleDataChange}
                    />
                  )}
                  {currentStep === 3 && (
                    <StepRepository
                      wizardData={wizardData}
                      onChange={handleDataChange}
                      hostEnvironmentDisabled={hostEnvironmentDisabled}
                    />
                  )}
                  {currentStep === 4 && (
                    <StepSession
                      createdProjectId={wizardData.createdProjectId}
                      environmentId={wizardData.environmentId}
                      sessionName={wizardData.sessionName}
                      onChange={handleDataChange}
                      onComplete={handleClose}
                      error={error}
                      onRetry={handleRetry}
                    />
                  )}
                </div>

                {/* ナビゲーションボタン（Step 4では非表示） */}
                {currentStep < 4 && (
                  <div className="mt-6 flex justify-between">
                    <div>
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          戻る
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={!canProceed() || isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? '処理中...' : '次へ'}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
