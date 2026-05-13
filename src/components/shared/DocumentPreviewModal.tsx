import { useRef, useEffect, useId } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DocumentPreview } from '../../types/documents';
import { isImagePreviewSource } from '../../utils/documentHelpers';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DocumentPreviewModalProps {
  preview: DocumentPreview | null;
  onClose: () => void;
  onOpenExternal?: (relativePath?: string | null) => void | Promise<void>;
  theme?: 'light' | 'dark';
}

export default function DocumentPreviewModal({
  preview,
  onClose,
  onOpenExternal,
  theme = 'light',
}: DocumentPreviewModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isDark = theme === 'dark';
  const isImage = preview ? isImagePreviewSource(preview.name, preview.url) : false;

  useFocusTrap(panelRef, !!preview);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          isDark
            ? 'bg-dark-charcoal/90 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col'
            : 'bg-white rounded-xl max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col'
        }
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={
            isDark
              ? 'flex items-center justify-between p-2 border-b border-secondary-gray/40'
              : 'flex items-center justify-between p-3 border-b border-secondary-gray'
          }
        >
          <span
            id={titleId}
            className={isDark ? 'text-white truncate' : 'font-medium text-dark-charcoal truncate'}
          >
            {preview.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={
              isDark
                ? 'text-secondary-gray hover:text-white px-2'
                : 'p-2 rounded-lg hover:bg-secondary-gray/30'
            }
          >
            {t('documentPreview.close')}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-secondary-gray/10 relative">
          {isImage ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="max-w-full max-h-[80vh] object-contain shadow-lg rounded-lg"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center">
              <webview
                src={preview.url}
                style={{ width: '100%', height: '75vh', borderRadius: '0.5rem' }}
                plugins="true"
              />
              <div className={isDark ? 'mt-4 flex flex-col items-center gap-2' : 'mt-4 flex gap-3'}>
                <button
                  type="button"
                  onClick={() => onOpenExternal?.(preview.relativePath)}
                  className={
                    isDark
                      ? 'flex items-center gap-2 px-6 py-2 bg-primary-gold text-white rounded-lg hover:bg-accent-sand transition-colors font-medium shadow-md'
                      : 'flex items-center gap-2 px-6 py-2 bg-primary-gold text-white rounded-lg hover:bg-accent-sand transition-colors font-medium'
                  }
                >
                  <Download size={18} aria-hidden />
                  {t('documentPreview.openExternal')}
                </button>
                <p
                  className={
                    isDark ? 'text-xs text-secondary-gray/80' : 'text-xs text-dark-charcoal/50 self-center'
                  }
                >
                  {t('documentPreview.emptyHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
