import type { ReactNode } from 'react';
import { ViewModeToggle, type ViewMode } from './ViewModeToggle';

export type { ViewMode };

export interface EntityListViewProps {
  title: ReactNode;
  dir?: 'rtl' | 'ltr';
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  toolbarEnd?: ReactNode;
  /** When false, view toggle is hidden */
  showViewToggle?: boolean;
  children: ReactNode;
}

/**
 * Shared list page shell: title row, view toggle, white content card.
 * Persist `viewMode` in the parent with `useViewMode(storageKey)` or `usePersistedViewMode(storageKey)` when needed.
 */
export function EntityListView({
  title,
  dir = 'rtl',
  viewMode,
  onViewModeChange,
  toolbarEnd,
  showViewToggle = true,
  children,
}: EntityListViewProps) {
  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {typeof title === 'string' ? <h1 className="text-2xl font-bold text-dark-charcoal">{title}</h1> : title}
        <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          {showViewToggle && <ViewModeToggle value={viewMode} onChange={onViewModeChange} />}
          {toolbarEnd}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-secondary-gray shadow-sm p-6">{children}</div>
    </div>
  );
}
