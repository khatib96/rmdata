import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Store, Users, Smartphone, Car, FolderOpen } from 'lucide-react';
import TaxIcon from '../components/Icons/TaxIcon';
import { HomeMainIcon } from '../components/Layout/BottomNav';
import { usePermissions } from '../hooks/usePermissions';

/** أيقونة أصحاب العمل (نفس الشريط الجانبي) — للاستخدام على خلفية ذهبية فاتحة */
function OwnerIconTile({ size = 28 }: { size?: number }) {
  return (
    <img
      src="./icons/owner.png"
      alt=""
      className="shrink-0"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'brightness(0) invert(1)',
      }}
    />
  );
}

type ServiceItem = {
  path: string;
  navKey: string;
  icon?: LucideIcon | typeof TaxIcon;
  customIcon?: 'homeMain' | 'owner';
};

/** أقسام القائمة الرئيسية + المستندات — التسميات من nav؛ الرئيسية بأيقونة الشريط السفلي، أصحاب العمل بأيقونة الشريط الجانبي */
/** module: null = دائما ظاهر (الرئيسية) */
const serviceItems: (ServiceItem & { module: string | null })[] = [
  { path: '/dashboard', navKey: 'home', customIcon: 'homeMain', module: null },
  { path: '/dashboard/branches', icon: Store, navKey: 'branches', module: 'branches' },
  { path: '/dashboard/employers', navKey: 'employers', customIcon: 'owner', module: 'employers' },
  { path: '/dashboard/employees', icon: Users, navKey: 'employees', module: 'employees' },
  { path: '/dashboard/housing', icon: Home, navKey: 'housing', module: 'housing' },
  { path: '/dashboard/phones', icon: Smartphone, navKey: 'phones', module: 'phones' },
  { path: '/dashboard/vehicles', icon: Car, navKey: 'vehicles', module: 'vehicles' },
  { path: '/dashboard/entities', icon: TaxIcon, navKey: 'taxes', module: 'entities' },
  { path: '/dashboard/documents', icon: FolderOpen, navKey: 'documents', module: 'documents' },
];

export default function Services() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canSection } = usePermissions();
  const visibleItems = useMemo(
    () => serviceItems.filter((item) => !item.module || canSection(item.module)),
    [canSection]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal mb-1">{t('services.title')}</h1>
        <p className="text-secondary-gray">{t('services.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="aspect-square min-h-[100px] flex flex-col items-center justify-center gap-2 rounded-xl bg-primary-gold text-white shadow-md hover:bg-primary-gold/90 hover:shadow-lg active:scale-[0.98] transition-all min-w-[44px] min-h-[44px]"
            >
              {item.customIcon === 'homeMain' ? (
                <HomeMainIcon size={28} className="text-white" />
              ) : item.customIcon === 'owner' ? (
                <OwnerIconTile size={28} />
              ) : (
                Icon && <Icon size={28} strokeWidth={2} />
              )}
              <span className="text-xs font-medium text-center leading-tight px-1 line-clamp-2">
                {t(`nav.${item.navKey}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
