import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the cancel button on open for safety
    cancelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-xl bg-white shadow-xl dark:bg-gray-800',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                variant === 'danger'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-yellow-100 dark:bg-yellow-900/30',
              )}
            >
              <AlertTriangle
                className={cn(
                  'h-5 w-5',
                  variant === 'danger'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400',
                )}
              />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </h3>
              <p
                id="confirm-dialog-message"
                className="mt-2 text-sm text-gray-500 dark:text-gray-400"
              >
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
