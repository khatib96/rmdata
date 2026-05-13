import { Archive, Trash2 } from 'lucide-react';

export type ConfirmModalVariant = 'archive' | 'delete';

export interface ConfirmModalProps {
  open: boolean;
  variant: ConfirmModalVariant;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  dir?: 'rtl' | 'ltr';
}

export function ConfirmModal({
  open,
  variant,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  dir = 'rtl',
}: ConfirmModalProps) {
  if (!open) return null;
  const Icon = variant === 'archive' ? Archive : Trash2;
  const iconColor = variant === 'archive' ? 'text-amber-600' : 'text-red-600';
  const btnClass =
    variant === 'archive'
      ? 'px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700'
      : 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-secondary-gray"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className={`flex items-center gap-3 ${iconColor} mb-4`}>
          <Icon size={28} aria-hidden />
          <h3 id="confirm-modal-title" className="font-bold text-lg text-dark-charcoal">
            {title}
          </h3>
        </div>
        <p className="text-dark-charcoal mb-4">{message}</p>
        <div className={`flex gap-2 ${dir === 'rtl' ? 'justify-start' : 'justify-end'}`}>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={btnClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
