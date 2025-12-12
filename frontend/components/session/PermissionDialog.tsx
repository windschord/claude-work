'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PermissionRequest } from '@/lib/api';

interface PermissionDialogProps {
  permission: PermissionRequest | null;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

export default function PermissionDialog({
  permission,
  onApprove,
  onReject,
  isLoading,
}: PermissionDialogProps) {
  const isOpen = permission !== null;

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="max-w-lg w-full bg-white rounded-lg shadow-xl p-6">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-4">
            権限確認
          </DialogTitle>

          {permission && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">タイプ:</span> {permission.type}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {permission.description}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onReject}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              拒否
            </button>
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              承認
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
