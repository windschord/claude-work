'use client';

import { useState, Fragment, useEffect, useCallback, useRef } from 'react';
import { Dialog, Transition, Listbox, RadioGroup } from '@headlessui/react';
import { ChevronDown, Check, Loader2, Upload, X, FileText } from 'lucide-react';
import { Environment, EnvironmentType, CreateEnvironmentInput, UpdateEnvironmentInput } from '@/hooks/useEnvironments';

interface EnvironmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<Environment | void>;
  environment?: Environment | null;
  mode: 'create' | 'edit';
}

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
  created: string;
}

type ImageSourceType = 'existing' | 'dockerfile';

const ENVIRONMENT_TYPES: { value: EnvironmentType; label: string; description: string }[] = [
  { value: 'HOST', label: 'ホスト', description: 'ローカルホスト環境で実行' },
  { value: 'DOCKER', label: 'Docker', description: 'Dockerコンテナ内で実行' },
  { value: 'SSH', label: 'SSH', description: 'SSHリモート接続（未実装）' },
];

const IMAGE_SOURCE_OPTIONS: { value: ImageSourceType; label: string }[] = [
  { value: 'existing', label: '既存イメージを使用' },
  { value: 'dockerfile', label: 'Dockerfileからビルド' },
];

const CUSTOM_IMAGE_VALUE = '__custom__';

/**
 * 環境作成・編集フォームモーダルコンポーネント
 *
 * 新規環境の作成と既存環境の編集を行うモーダルダイアログです。
 * バリデーション、エラーハンドリング、ローディング状態の管理を行います。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.onSubmit - フォーム送信時のコールバック関数
 * @param props.environment - 編集対象の環境情報（編集モード時）
 * @param props.mode - 'create' または 'edit'
 * @returns 環境フォームモーダルのJSX要素
 */
export function EnvironmentForm({ isOpen, onClose, onSubmit, environment, mode }: EnvironmentFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<EnvironmentType>('HOST');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Docker image settings
  const [imageSource, setImageSource] = useState<ImageSourceType>('existing');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [customImageName, setCustomImageName] = useState('');
  const [dockerfileFile, setDockerfileFile] = useState<File | null>(null);
  const [dockerfileUploaded, setDockerfileUploaded] = useState(false);
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Dockerイメージ一覧を取得
   */
  const fetchDockerImages = useCallback(async () => {
    setIsLoadingImages(true);
    setImageError(null);

    try {
      const response = await fetch('/api/docker/images');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Dockerイメージの取得に失敗しました');
      }

      setDockerImages(data.images);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Dockerイメージの取得に失敗しました';
      setImageError(errorMessage);
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  // 編集モードの場合、既存の値を設定
  useEffect(() => {
    if (mode === 'edit' && environment) {
      setName(environment.name);
      setType(environment.type);
      setDescription(environment.description || '');

      // configからDocker設定を復元
      if (environment.type === 'DOCKER' && environment.config) {
        try {
          const config = typeof environment.config === 'string'
            ? JSON.parse(environment.config)
            : environment.config;

          if (config.imageSource === 'dockerfile') {
            setImageSource('dockerfile');
            setDockerfileUploaded(config.dockerfileUploaded || false);
          } else {
            setImageSource('existing');
            if (config.imageName) {
              const imageValue = config.imageTag
                ? `${config.imageName}:${config.imageTag}`
                : config.imageName;
              setSelectedImage(imageValue);
            }
          }
        } catch {
          // configのパースに失敗した場合はデフォルト値を使用
        }
      }
    } else if (mode === 'create') {
      setName('');
      setType('HOST');
      setDescription('');
      setImageSource('existing');
      setSelectedImage('');
      setCustomImageName('');
      setDockerfileFile(null);
      setDockerfileUploaded(false);
    }
  }, [mode, environment, isOpen]);

  // タイプがDOCKERに変わった時にイメージ一覧を取得
  useEffect(() => {
    if (type === 'DOCKER' && isOpen) {
      fetchDockerImages();
    }
  }, [type, isOpen, fetchDockerImages]);

  /**
   * Docker設定のconfigオブジェクトを生成
   */
  const buildDockerConfig = (): object => {
    if (imageSource === 'dockerfile') {
      return {
        imageSource: 'dockerfile',
        dockerfileUploaded: false, // Will be set to true after upload
      };
    } else {
      // 既存イメージを使用
      const imageFull = selectedImage === CUSTOM_IMAGE_VALUE
        ? customImageName.trim()
        : selectedImage;

      // imageName:imageTag の形式をパース
      const [imageName, imageTag] = imageFull.includes(':')
        ? imageFull.split(':')
        : [imageFull, 'latest'];

      return {
        imageSource: 'existing',
        imageName,
        imageTag,
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('環境名を入力してください');
      return;
    }

    // Docker環境の場合の追加バリデーション
    if (type === 'DOCKER' && mode === 'create') {
      if (imageSource === 'existing') {
        const imageName = selectedImage === CUSTOM_IMAGE_VALUE
          ? customImageName.trim()
          : selectedImage;
        if (!imageName) {
          setError('Dockerイメージを選択または入力してください');
          return;
        }
      } else if (imageSource === 'dockerfile') {
        if (!dockerfileFile) {
          setError('Dockerfileをアップロードしてください');
          return;
        }
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'create') {
        const config = type === 'DOCKER' ? buildDockerConfig() : {};
        const createdEnv = await onSubmit({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          config,
        } as CreateEnvironmentInput);

        // Docker環境でDockerfileがある場合、アップロードとビルドを実行
        if (createdEnv && type === 'DOCKER' && imageSource === 'dockerfile' && dockerfileFile) {
          // Dockerfileをアップロード
          const uploadSuccess = await uploadDockerfile(createdEnv.id);
          if (!uploadSuccess) {
            // アップロード失敗時はエラーを表示して終了（環境は作成済み）
            return;
          }

          // イメージをビルド
          try {
            const buildResponse = await fetch('/api/docker/image-build', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dockerfilePath: `data/environments/${createdEnv.id}/Dockerfile`,
                imageName: `claude-work-env-${createdEnv.id}`,
                imageTag: 'latest',
              }),
            });

            if (!buildResponse.ok) {
              const result = await buildResponse.json();
              // ビルド失敗は警告として表示（環境とDockerfileは保存済み）
              setError(`環境は作成されましたが、イメージのビルドに失敗しました: ${result.error || 'ビルドエラー'}`);
              // 環境は作成済みなので画面を閉じる
              handleClose();
              return;
            }
          } catch (buildErr) {
            setError('環境は作成されましたが、イメージのビルドに失敗しました');
            handleClose();
            return;
          }
        }
      } else {
        const updateInput: UpdateEnvironmentInput = {
          name: name.trim(),
          description: description.trim() || undefined,
        };

        // 編集モードでもDocker設定を更新可能にする
        if (environment?.type === 'DOCKER') {
          updateInput.config = buildDockerConfig();
        }

        await onSubmit(updateInput);
      }
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dockerfileをアップロード
   */
  const uploadDockerfile = async (environmentId: string): Promise<boolean> => {
    if (!dockerfileFile) return true;

    const formData = new FormData();
    formData.append('dockerfile', dockerfileFile);

    try {
      const response = await fetch(`/api/environments/${environmentId}/dockerfile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Dockerfileのアップロードに失敗しました');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Dockerfileのアップロードに失敗しました';
      setError(errorMessage);
      return false;
    }
  };

  /**
   * ドラッグ&ドロップハンドラー
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      setDockerfileFile(file);
    }
  };

  /**
   * ファイル選択ハンドラー
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDockerfileFile(file);
    }
  };

  /**
   * ファイル削除ハンドラー
   */
  const handleRemoveFile = () => {
    setDockerfileFile(null);
    setDockerfileUploaded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setName('');
    setType('HOST');
    setDescription('');
    setError('');
    setImageSource('existing');
    setSelectedImage('');
    setCustomImageName('');
    setDockerfileFile(null);
    setDockerfileUploaded(false);
    setIsDragging(false);
    onClose();
  };

  const selectedTypeOption = ENVIRONMENT_TYPES.find((t) => t.value === type);

  // イメージ選択用のオプションを構築
  const imageOptions = [
    ...dockerImages.map((img) => ({
      value: `${img.repository}:${img.tag}`,
      label: `${img.repository}:${img.tag}`,
    })),
    { value: CUSTOM_IMAGE_VALUE, label: 'カスタムイメージを入力...' },
  ];

  // 現在選択されているイメージのラベルを取得
  const getSelectedImageLabel = () => {
    if (!selectedImage) return 'イメージを選択...';
    if (selectedImage === CUSTOM_IMAGE_VALUE) return 'カスタムイメージを入力...';
    return selectedImage;
  };

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  {mode === 'create' ? '環境を追加' : '環境を編集'}
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label
                      htmlFor="environment-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      環境名
                    </label>
                    <input
                      id="environment-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例: Docker Dev"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                  </div>

                  {mode === 'create' && (
                    <div className="mb-4">
                      <label
                        htmlFor="environment-type"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        タイプ
                      </label>
                      <Listbox value={type} onChange={setType} disabled={isLoading}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <span className="block truncate text-gray-900 dark:text-gray-100">
                              {selectedTypeOption?.label}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronDown
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                              />
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              {ENVIRONMENT_TYPES.map((typeOption) => (
                                <Listbox.Option
                                  key={typeOption.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                      active
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                        : 'text-gray-900 dark:text-gray-100'
                                    }`
                                  }
                                  value={typeOption.value}
                                  disabled={typeOption.value === 'SSH'}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className="flex flex-col">
                                        <span
                                          className={`block truncate ${
                                            selected ? 'font-medium' : 'font-normal'
                                          } ${typeOption.value === 'SSH' ? 'opacity-50' : ''}`}
                                        >
                                          {typeOption.label}
                                        </span>
                                        <span className={`block text-xs text-gray-500 dark:text-gray-400 ${typeOption.value === 'SSH' ? 'opacity-50' : ''}`}>
                                          {typeOption.description}
                                        </span>
                                      </div>
                                      {selected && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                                          <Check className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                      )}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>
                  )}

                  {/* Docker Image Settings - Shown when type is DOCKER */}
                  {((mode === 'create' && type === 'DOCKER') || (mode === 'edit' && environment?.type === 'DOCKER')) && (
                    <div className="mb-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        イメージソース
                      </h4>

                      {/* Image Source Radio Group */}
                      <RadioGroup value={imageSource} onChange={setImageSource} disabled={isLoading}>
                        <div className="space-y-2">
                          {IMAGE_SOURCE_OPTIONS.map((option) => (
                            <RadioGroup.Option
                              key={option.value}
                              value={option.value}
                              className={({ checked }) =>
                                `relative flex cursor-pointer rounded-lg px-4 py-2 focus:outline-none ${
                                  checked
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                }`
                              }
                            >
                              {({ checked }) => (
                                <div className="flex w-full items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="text-sm">
                                      <RadioGroup.Label
                                        as="p"
                                        className={`font-medium ${
                                          checked
                                            ? 'text-blue-900 dark:text-blue-100'
                                            : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                      >
                                        {option.label}
                                      </RadioGroup.Label>
                                    </div>
                                  </div>
                                  {checked && (
                                    <div className="shrink-0 text-blue-600 dark:text-blue-400">
                                      <Check className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </RadioGroup.Option>
                          ))}
                        </div>
                      </RadioGroup>

                      {/* Existing Image Selection */}
                      {imageSource === 'existing' && (
                        <div className="mt-4 space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            イメージ
                          </label>

                          {isLoadingImages ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                イメージ一覧を取得中...
                              </span>
                            </div>
                          ) : imageError ? (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">{imageError}</p>
                              <button
                                type="button"
                                onClick={fetchDockerImages}
                                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                再読み込み
                              </button>
                            </div>
                          ) : (
                            <Listbox value={selectedImage} onChange={setSelectedImage} disabled={isLoading}>
                              <div className="relative">
                                <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                                  <span className={`block truncate ${!selectedImage ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {getSelectedImageLabel()}
                                  </span>
                                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                    <ChevronDown
                                      className="h-5 w-5 text-gray-400"
                                      aria-hidden="true"
                                    />
                                  </span>
                                </Listbox.Button>
                                <Transition
                                  as={Fragment}
                                  leave="transition ease-in duration-100"
                                  leaveFrom="opacity-100"
                                  leaveTo="opacity-0"
                                >
                                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {imageOptions.map((option) => (
                                      <Listbox.Option
                                        key={option.value}
                                        className={({ active }) =>
                                          `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                            active
                                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                              : 'text-gray-900 dark:text-gray-100'
                                          } ${option.value === CUSTOM_IMAGE_VALUE ? 'border-t border-gray-200 dark:border-gray-600' : ''}`
                                        }
                                        value={option.value}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span
                                              className={`block truncate ${
                                                selected ? 'font-medium' : 'font-normal'
                                              } ${option.value === CUSTOM_IMAGE_VALUE ? 'italic text-gray-500 dark:text-gray-400' : ''}`}
                                            >
                                              {option.label}
                                            </span>
                                            {selected && (
                                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                                                <Check className="h-5 w-5" aria-hidden="true" />
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </Transition>
                              </div>
                            </Listbox>
                          )}

                          {/* Custom Image Input */}
                          {selectedImage === CUSTOM_IMAGE_VALUE && (
                            <div className="mt-3">
                              <label
                                htmlFor="custom-image-name"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                              >
                                カスタムイメージ名
                              </label>
                              <input
                                id="custom-image-name"
                                type="text"
                                value={customImageName}
                                onChange={(e) => setCustomImageName(e.target.value)}
                                placeholder="例: my-custom-image:v1.0"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                disabled={isLoading}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dockerfile Upload */}
                      {imageSource === 'dockerfile' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dockerfile
                          </label>

                          {dockerfileFile || dockerfileUploaded ? (
                            // ファイル選択済み表示
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <span className="text-sm text-green-700 dark:text-green-300">
                                  {dockerfileFile?.name || 'Dockerfile'}
                                </span>
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveFile}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                disabled={isLoading}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            // ドラッグ&ドロップエリア
                            <div
                              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                isDragging
                                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                                accept="*"
                                disabled={isLoading}
                              />
                              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                disabled={isLoading}
                              >
                                ファイルを選択
                              </button>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                またはドラッグ&ドロップ
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
                    <label
                      htmlFor="environment-description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      説明（任意）
                    </label>
                    <textarea
                      id="environment-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="例: 開発用Docker環境"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      disabled={isLoading}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!name.trim() || isLoading}
                    >
                      {isLoading
                        ? mode === 'create'
                          ? '作成中...'
                          : '更新中...'
                        : mode === 'create'
                        ? '作成'
                        : '更新'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
