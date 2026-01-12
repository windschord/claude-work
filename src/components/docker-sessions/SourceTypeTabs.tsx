'use client';

import { Tab } from '@headlessui/react';
import { Globe, FolderOpen } from 'lucide-react';

type SourceType = 'remote' | 'local';

interface SourceTypeTabsProps {
  value: SourceType;
  onChange: (value: SourceType) => void;
  disabled?: boolean;
}

const tabs: { value: SourceType; label: string; icon: typeof Globe }[] = [
  { value: 'remote', label: 'Remote', icon: Globe },
  { value: 'local', label: 'Local', icon: FolderOpen },
];

/**
 * Tab component for switching between remote and local source types.
 *
 * Uses Headless UI TabGroup for accessibility support.
 */
export function SourceTypeTabs({ value, onChange, disabled = false }: SourceTypeTabsProps) {
  const selectedIndex = tabs.findIndex((tab) => tab.value === value);

  const handleChange = (index: number) => {
    const newValue = tabs[index].value;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={handleChange}>
      <Tab.List className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Tab
              key={tab.value}
              disabled={disabled}
              aria-disabled={disabled}
              className={({ selected }) =>
                `flex items-center justify-center gap-2 w-full rounded-md py-2 px-3 text-sm font-medium leading-5 transition-colors duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600/50'
                }
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`
              }
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </Tab>
          );
        })}
      </Tab.List>
    </Tab.Group>
  );
}
