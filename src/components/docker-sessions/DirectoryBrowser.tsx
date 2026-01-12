'use client';

import { useState, useEffect, useCallback } from 'react';
import { FolderGit2, Folder, File, ChevronRight, ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Directory entry from the API
 */
interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isGitRepository: boolean;
  isHidden: boolean;
}

/**
 * API response for directory browse
 */
interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

/**
 * DirectoryBrowser component props
 */
export interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

/**
 * DirectoryBrowser component state
 */
interface DirectoryBrowserState {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
}

/**
 * Parse path segments from a full path for breadcrumb display
 */
function parsePathSegments(path: string, homePath: string): { name: string; path: string }[] {
  const segments: { name: string; path: string }[] = [];

  // Always add home as the first segment
  segments.push({ name: '~', path: homePath });

  // If path is home, return just the home segment
  if (path === homePath) {
    return segments;
  }

  // Get the relative path from home
  const relativePath = path.startsWith(homePath) ? path.slice(homePath.length) : path;
  const parts = relativePath.split('/').filter(Boolean);

  let currentPath = homePath;
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    segments.push({ name: part, path: currentPath });
  }

  return segments;
}

/**
 * DirectoryBrowser component
 *
 * Displays a directory listing with navigation support.
 * Allows selection of Git repositories for session creation.
 */
export function DirectoryBrowser({ onSelect, onCancel }: DirectoryBrowserProps) {
  const [state, setState] = useState<DirectoryBrowserState>({
    currentPath: '',
    parentPath: null,
    entries: [],
    loading: true,
    error: null,
    selectedPath: null,
  });

  const [homePath, setHomePath] = useState<string>('');

  /**
   * Fetch directory contents from the API
   */
  const fetchDirectory = useCallback(async (path?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null, selectedPath: null }));

    try {
      const url = path ? `/api/filesystem/browse?path=${encodeURIComponent(path)}` : '/api/filesystem/browse';
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load directory');
      }

      const data: BrowseResponse = await response.json();

      // Set home path on first load
      if (!homePath && !path) {
        setHomePath(data.currentPath);
      }

      setState(prev => ({
        ...prev,
        currentPath: data.currentPath,
        parentPath: data.parentPath,
        entries: data.entries,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load directory',
      }));
    }
  }, [homePath]);

  // Load home directory on mount
  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  /**
   * Handle entry click (single click)
   * - For directories: select the entry
   * - For git repos: select the entry (can be selected with Select button)
   */
  const handleEntryClick = useCallback((entry: DirectoryEntry) => {
    if (entry.type === 'directory') {
      if (entry.isGitRepository) {
        // For git repos, just select (don't navigate)
        setState(prev => ({
          ...prev,
          selectedPath: prev.selectedPath === entry.path ? null : entry.path,
        }));
      } else {
        // For regular directories, navigate into them
        fetchDirectory(entry.path);
      }
    }
  }, [fetchDirectory]);

  /**
   * Handle entry double click
   * - For git repos: select and confirm
   */
  const handleEntryDoubleClick = useCallback((entry: DirectoryEntry) => {
    if (entry.type === 'directory' && entry.isGitRepository) {
      onSelect(entry.path);
    }
  }, [onSelect]);

  /**
   * Handle breadcrumb click
   */
  const handleBreadcrumbClick = useCallback((path: string) => {
    if (path === homePath) {
      fetchDirectory();
    } else {
      fetchDirectory(path);
    }
  }, [fetchDirectory, homePath]);

  /**
   * Handle select button click
   */
  const handleSelectClick = useCallback(() => {
    if (state.selectedPath) {
      onSelect(state.selectedPath);
    }
  }, [state.selectedPath, onSelect]);

  /**
   * Handle back button click
   */
  const handleBackClick = useCallback(() => {
    if (state.parentPath) {
      fetchDirectory(state.parentPath);
    }
  }, [state.parentPath, fetchDirectory]);

  // Filter hidden files
  const visibleEntries = state.entries.filter(entry => !entry.isHidden);

  // Sort entries: directories first, then files, alphabetically
  const sortedEntries = [...visibleEntries].sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  // Loading state
  if (state.loading && state.entries.length === 0) {
    return (
      <div className="flex flex-col h-full" data-testid="directory-browser-loading">
        <div className="flex items-center justify-center flex-1 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="flex flex-col h-full" data-testid="directory-browser-error">
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-red-600 dark:text-red-400 mb-4">{state.error}</p>
          <button
            data-testid="retry-button"
            onClick={() => fetchDirectory(state.currentPath || undefined)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pathSegments = homePath ? parsePathSegments(state.currentPath, homePath) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* Back button */}
        {state.parentPath && (
          <button
            data-testid="back-button"
            onClick={handleBackClick}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Go back"
          >
            <ArrowLeft size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        )}

        {/* Breadcrumb */}
        <nav data-testid="breadcrumb" className="flex items-center gap-1 text-sm overflow-x-auto">
          {pathSegments.map((segment, index) => (
            <span key={segment.path} className="flex items-center">
              {index > 0 && (
                <ChevronRight size={14} className="mx-1 text-gray-400" />
              )}
              <button
                data-testid={segment.name === '~' ? 'breadcrumb-home' : `breadcrumb-${segment.name}`}
                onClick={() => handleBreadcrumbClick(segment.path)}
                className={`hover:text-blue-600 dark:hover:text-blue-400 ${
                  index === pathSegments.length - 1
                    ? 'text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {segment.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Loading indicator for navigation */}
        {state.loading && (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 ml-auto" />
        )}
      </div>

      {/* Directory listing */}
      <div className="flex-1 overflow-y-auto">
        {sortedEntries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            This directory is empty
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedEntries.map((entry) => (
              <li
                key={entry.path}
                data-testid={`entry-${entry.path}`}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleEntryDoubleClick(entry)}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  state.selectedPath === entry.path
                    ? 'selected bg-blue-50 dark:bg-blue-900/30'
                    : ''
                }`}
              >
                {/* Icon */}
                {entry.type === 'file' ? (
                  <span data-testid="file-icon">
                    <File
                      size={18}
                      className="text-gray-400 dark:text-gray-500"
                    />
                  </span>
                ) : entry.isGitRepository ? (
                  <span data-testid="git-folder-icon">
                    <FolderGit2
                      size={18}
                      className="text-orange-500 dark:text-orange-400"
                    />
                  </span>
                ) : (
                  <span data-testid="folder-icon">
                    <Folder
                      size={18}
                      className="text-blue-500 dark:text-blue-400"
                    />
                  </span>
                )}

                {/* Name */}
                <span className={`flex-1 text-sm ${
                  entry.type === 'file'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {entry.name}
                </span>

                {/* Git badge */}
                {entry.isGitRepository && (
                  <span className="px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 rounded">
                    Git
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          data-testid="cancel-button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          data-testid="select-button"
          onClick={handleSelectClick}
          disabled={!state.selectedPath}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select
        </button>
      </div>
    </div>
  );
}
