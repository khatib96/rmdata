import { useTranslation } from 'react-i18next';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'grid' | 'list';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ value, onChange, className = '' }: ViewModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div className={`inline-flex rounded-lg border border-secondary-gray overflow-hidden ${className}`} dir="ltr">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex items-center gap-2 px-3 py-2 transition-colors ${
          value === 'grid'
            ? 'bg-primary-gold text-white'
            : 'bg-white text-dark-charcoal hover:bg-secondary-gray/20'
        }`}
        title={t('common.grid')}
      >
        <LayoutGrid size={18} />
        <span className="text-sm font-medium">{t('common.grid')}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`flex items-center gap-2 px-3 py-2 border-l border-secondary-gray transition-colors ${
          value === 'list'
            ? 'bg-primary-gold text-white'
            : 'bg-white text-dark-charcoal hover:bg-secondary-gray/20'
        }`}
        title={t('common.list')}
      >
        <List size={18} />
        <span className="text-sm font-medium">{t('common.list')}</span>
      </button>
    </div>
  );
}
