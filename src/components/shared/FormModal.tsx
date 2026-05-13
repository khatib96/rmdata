import { useRef, useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional step tabs: { step, label }[] */
  steps?: { step: number; label: string }[];
  currentStep?: number;
  onStepClick?: (step: number) => void;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  steps,
  currentStep = 1,
  onStepClick,
}: FormModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col modal-box-mobile"
        tabIndex={-1}
      >
        <div className="sticky top-0 bg-primary-gold text-white p-6 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 id={titleId} className="text-2xl font-bold">
              {title}
            </h2>
            {subtitle && <p className="text-sm opacity-90 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('nav.close')}
          >
            <X size={24} aria-hidden />
          </button>
        </div>

        {steps && steps.length > 0 && (
          <div className="flex gap-2 p-4 border-b border-secondary-gray/50 bg-white shrink-0" aria-label={title}>
            {steps.map(({ step, label }) => (
              <button
                key={step}
                type="button"
                onClick={() => onStepClick?.(step)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === step
                    ? 'bg-primary-gold text-white'
                    : 'bg-secondary-gray/30 text-dark-charcoal hover:bg-secondary-gray/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
