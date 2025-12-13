'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PermissionRequest } from '@/store';

interface PermissionDialogProps {
  isOpen: boolean;
  permission: PermissionRequest | null;
  onApprove: (permissionId: string) => void;
  onReject: (permissionId: string) => void;
  onClose: () => void;
}

export default function PermissionDialog({
  isOpen,
  permission,
  onApprove,
  onReject,
  onClose,
}: PermissionDialogProps) {
  if (!permission) {
    return null;
  }

  const handleApprove = () => {
    onApprove(permission.id);
    onClose();
  };

  const handleReject = () => {
    onReject(permission.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            権限の確認
          </DialogTitle>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              {permission.description}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {permission.details}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleReject}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              拒否
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              承認
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
