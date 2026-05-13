import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Home, LayoutGrid, Square } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

const SAFE_BOTTOM = 'pb-[env(safe-area-inset-bottom)]';
const MIN_TOUCH = 'min-w-[44px] min-h-[44px]';
const BAR_BG = 'bg-[#A37A3F]';

/** أيقونة الرئيسية: مربع وداخله نقطة (شكل الصفحة الرئيسية) — تُصدَّر للاستخدام في الشريط السفلي والقائمة الجانبية */
export function HomeMainIcon({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Square size={size} strokeWidth={2} className="text-current" />
      <span
        className="absolute rounded-full bg-current"
        style={{ width: size * 0.35, height: size * 0.35 }}
      />
    </span>
  );
}

/** القائمة الرئيسية (الشريط السفلي) — الرئيسية بدائرة قبة + أيقونة مربع ونقطة؛ السكن بأيقونة البيت */
const navItems: { path: string; icon: typeof Building2; labelKey: string; module: string | null }[] = [
  { path: '/dashboard/branches', icon: Building2, labelKey: 'nav.branchesShort', module: 'branches' },
  { path: '/dashboard/employees', icon: Users, labelKey: 'nav.employees', module: 'employees' },
  { path: '/dashboard', icon: Square, labelKey: 'nav.home', module: null },
  { path: '/dashboard/housing', icon: Home, labelKey: 'nav.housing', module: 'housing' },
  { path: '/dashboard/services', icon: LayoutGrid, labelKey: 'nav.services', module: null },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const { canSection } = usePermissions();
  const visibleItems = useMemo(
    () => navItems.filter((item) => !item.module || canSection(item.module)),
    [canSection]
  );
  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 h-16 ${SAFE_BOTTOM} pt-2 ${BAR_BG} border-t border-[#8a6a35] flex items-stretch justify-between gap-0.5 px-1 sm:px-2 z-30`}
      role="navigation"
      aria-label={t('nav.bottomNavAria')}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isHome = item.path === '/dashboard';

        if (isHome) {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center rounded-full w-14 h-14 sm:w-16 sm:h-16 -mt-5 shrink-0 ${BAR_BG} ${
                  isActive ? 'text-white' : 'text-white/80 hover:text-white'
                } transition-colors`
              }
            >
              <HomeMainIcon size={40} className="text-white" />
              <span className="text-[10px] sm:text-[12px] mt-0.5 font-medium truncate max-w-[3.5rem] sm:max-w-none">{t(item.labelKey)}</span>
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 rounded-lg min-w-0 flex-1 py-1.5 px-0.5 sm:px-2 transition-colors ${
                isActive
                  ? 'bg-secondary-gray/30 text-white shadow-sm'
                  : 'text-white/90 hover:bg-secondary-gray/20 hover:text-white'
              }`
            }
          >
            <Icon size={24} className="shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-medium truncate w-full text-center min-w-0">{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
