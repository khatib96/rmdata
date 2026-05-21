import { type LucideIcon } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface TabsOrDropdownProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** استبعاد تبويبات (مثلاً إخفاء entity في بعض الحالات) */
  filter?: (tab: TabItem) => boolean;
  /** محتوى إضافي بجانب التبويبات (مثل زر تعديل) */
  extra?: React.ReactNode;
}

export default function TabsOrDropdown({
  tabs,
  activeTab,
  onTabChange,
  filter,
  extra,
}: TabsOrDropdownProps) {
  const isMobile = useIsMobile();
  const list = filter ? tabs.filter(filter) : tabs;

  if (isMobile) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary-gray mb-4">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="flex-1 min-w-0 max-w-[280px] px-4 py-3 rounded-lg border border-secondary-gray bg-white text-dark-charcoal font-medium focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
          aria-label="اختر القسم"
        >
          {list.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        {extra}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 border-b border-secondary-gray mb-4">
      <div className="flex gap-1 overflow-x-auto flex-1 min-w-0 order-1 rtl:order-2">
        {list.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-gold text-primary-gold font-medium'
                  : 'border-transparent text-dark-charcoal/70 hover:text-dark-charcoal'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              {tab.badge != null && (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-xs font-bold rounded-full mr-1 ${activeTab === tab.id ? 'bg-primary-gold text-white' : 'bg-primary-gold/20 text-primary-gold'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {extra != null ? <div className="shrink-0 order-2 rtl:order-1 flex items-center gap-2">{extra}</div> : null}
    </div>
  );
}
