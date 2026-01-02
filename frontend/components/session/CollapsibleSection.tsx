'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOpen();
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg my-4 overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title}`}
      >
        <span className="text-gray-600 font-mono text-sm select-none">
          {isOpen ? '▼' : '▶'}
        </span>
        <span className="font-medium text-gray-800">{title}</span>
      </div>
      <div
        id={`collapsible-content-${title}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
