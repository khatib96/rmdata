export interface DocumentNameModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Small overlay to name an attached file before queueing upload (custom sections, housing, vehicles).
 */
export function DocumentNameModal({
  open,
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: DocumentNameModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onCancel}>
      <div
        className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-name-modal-title"
      >
        <h4 id="doc-name-modal-title" className="font-bold text-dark-charcoal mb-2">
          {title}
        </h4>
        {subtitle && <p className="text-sm text-dark-charcoal/70 mb-2">{subtitle}</p>}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
