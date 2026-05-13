import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw } from 'lucide-react';

interface ArchivedEntityCardProps {
  label: string;
  isRestoring: boolean;
  onRestore: () => void;
}

export default function ArchivedEntityCard({
  label,
  isRestoring,
  onRestore,
}: ArchivedEntityCardProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-dark-charcoal/50 border border-secondary-gray/40 text-secondary-gray">
      <span className="truncate font-medium text-white/90">{label}</span>
      <button
        type="button"
        disabled={isRestoring}
        onClick={onRestore}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-gold/90 text-white hover:bg-primary-gold font-medium text-sm shrink-0 disabled:opacity-50"
      >
        {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
        {t('archive.restore')}
      </button>
    </div>
  );
}
