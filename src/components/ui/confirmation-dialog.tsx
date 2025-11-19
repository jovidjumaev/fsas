'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, X } from 'lucide-react';
import { createLogger } from '../../lib/logger';
const logger = createLogger('confirmation-dialog');

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default'
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    logger.log('✅ Confirmation dialog confirm button clicked');
    logger.log('✅ Current URL before confirm:', window.location.href);
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800 dark:border-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {title}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {message}
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              className={variant === 'destructive' ? 'dark:bg-red-600 dark:hover:bg-red-700' : ''}
            >
              {confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
