'use client';

import { useState, useCallback, useRef, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Key, FolderGit2, Play } from 'lucide-react';
import { useAppStore } from '@/store';
import toast from 'react-hot-toast';

import { WizardProgressBar } from './WizardProgressBar';
import { StepAuthentication } from './StepAuthentication';
import { StepRepository } from './StepRepository';
import { StepSession } from './StepSession';
import { initialWizardData } from './types';
import type { WizardData, WizardStep } from './types';

const WIZARD_STEPS: WizardStep[] = [
  { id: 1, label: '認証', icon: Key },
  { id: 2, label: 'リポジトリ', icon: FolderGit2 },
  { id: 3, label: 'セッション', icon: Play },
];

interface AddProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 3;

export function AddProjectWizard({ isOpen, onClose }: AddProjectWizardProps) {
  const { fetchProjects } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({ ...initialWizardData });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // サーバーからhostEnvironmentDisabledを動的に取得する
  // Docker環境ではHOST環境は利用不可のため、/api/healthから判定する
  const [hostEnvironmentDisabled, setHostEnvironmentDisabled] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { features?: { hostEnvironmentDisabled?: boolean } }) => {
        setHostEnvironmentDisabled(data.features?.hostEnvironmentDisabled ?? true);
      })
      .catch(() => {
        // フェッチ失敗時はデフォルトのtrue（無効）を維持
      });
  }, []);

  const handleDataChange = useCallback((data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    submitInFlightRef.current = false;
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
        return true; // 認証はオプション
      case 2:
        if (wizardData.repoType === 'local') {
          return !!wizardData.localPath.trim();
        }
        return !!wizardData.remoteUrl.trim();
      default:
        return false;
    }
  }, [currentStep, wizardData]);

  /** レスポンスからエラーメッセージを安全に抽出する */
  const parseErrorResponse = async (response: Response, fallback: string): Promise<string> => {
    const raw = await response.text().catch(() => '');
    if (!raw) return fallback;
    try {
      const data = JSON.parse(raw) as { error?: string };
      return data.error || raw || fallback;
    } catch {
      return raw || fallback;
    }
  };

  const handleNext = useCallback(async () => {
    if (currentStep === 2) {
      if (submitInFlightRef.current || isSubmitting) return;
      submitInFlightRef.current = true;

      // 前回の送信をキャンセル
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
            }),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(await parseErrorResponse(response, 'プロジェクトの追加に失敗しました'));
          }
          const data = await response.json();
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
            }),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(await parseErrorResponse(response, 'リポジトリのcloneに失敗しました'));
          }
          const data = await response.json();
          projectId = data.project.id;
        }

        // キャンセル済みなら結果を無視
        if (controller.signal.aborted) return;

        handleDataChange({ createdProjectId: projectId });
        toast.success('プロジェクトを追加しました');
        setCurrentStep(3);

        // プロジェクトリスト更新は成功/失敗に関わらずStep 3遷移には影響しない
        try {
          await fetchProjects();
        } catch {
          // プロジェクト一覧の再取得失敗はUI操作に影響しないため無視
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const errorMessage = err instanceof Error ? err.message : 'プロジェクトの追加に失敗しました';
        setError(errorMessage);
        setCurrentStep(3);
      } finally {
        submitInFlightRef.current = false;
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (!controller.signal.aborted) {
          setIsSubmitting(false);
        }
      }
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, wizardData, isSubmitting, fetchProjects, handleDataChange]);

  const handleBack = useCallback(() => {
    if (isSubmitting) return;
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, isSubmitting]);

  const handleStepClick = useCallback((step: number) => {
    if (step < currentStep && !isSubmitting) {
      setCurrentStep(step);
    }
  }, [currentStep, isSubmitting]);

  const handleRetry = useCallback(() => {
    setError(null);
    setCurrentStep(2);
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
                    aria-label="閉じる"
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
                    <StepAuthentication
                      githubPatId={wizardData.githubPatId}
                      onChange={handleDataChange}
                    />
                  )}
                  {currentStep === 2 && (
                    <StepRepository
                      wizardData={wizardData}
                      onChange={handleDataChange}
                      hostEnvironmentDisabled={hostEnvironmentDisabled}
                    />
                  )}
                  {currentStep === 3 && (
                    <StepSession
                      createdProjectId={wizardData.createdProjectId}
                      sessionName={wizardData.sessionName}
                      onChange={handleDataChange}
                      onComplete={handleClose}
                      error={error}
                      onRetry={handleRetry}
                    />
                  )}
                </div>

                {/* ナビゲーションボタン（Step 3では非表示） */}
                {currentStep < 3 && (
                  <div className="mt-6 flex justify-between">
                    <div>
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={isSubmitting}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
