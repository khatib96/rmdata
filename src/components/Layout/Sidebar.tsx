import { useState, useEffect, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Store, Users, Smartphone, Car } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import TaxIcon from '../Icons/TaxIcon';
import { HomeMainIcon } from './BottomNav';

// أيقونة مخصصة لصاحب العمل من ملف PNG — عند التفعيل أبيض مثل باقي الأقسام
function OwnerIcon({ isActive, alt }: { isActive: boolean; alt: string }) {
  return (
    <img
      src="./icons/owner.png"
      alt={alt}
      className="shrink-0"
      style={{
        width: 20,
        height: 20,
        objectFit: 'contain',
        // عند التفعيل: أبيض مثل باقي الأقسام — عند عدم التفعيل: رمادي داكن
        filter: isActive
          ? 'brightness(0) invert(1)'
          : 'invert(30%) sepia(5%) saturate(300%) hue-rotate(180deg) brightness(70%)',
        transition: 'filter 200ms ease',
      }}
    />
  );
}

/** قائمة الخدمات (القائمة الجانبية) — module: null = الرئيسية (ظاهرة دائما) */
type SidebarMenuIcon = LucideIcon | typeof TaxIcon;

const menuItems: { path: string; icon: SidebarMenuIcon | null; labelKey: string; customIcon: string | null; module: string | null }[] = [
  { path: '/dashboard', icon: null, labelKey: 'nav.home', customIcon: null, module: null },
  { path: '/dashboard/branches', icon: Store, labelKey: 'nav.branches', customIcon: null, module: 'branches' },
  { path: '/dashboard/employers', icon: null, labelKey: 'nav.employers', customIcon: 'owner', module: 'employers' },
  { path: '/dashboard/employees', icon: Users, labelKey: 'nav.employees', customIcon: null, module: 'employees' },
  { path: '/dashboard/housing', icon: Home, labelKey: 'nav.housing', customIcon: null, module: 'housing' },
  { path: '/dashboard/phones', icon: Smartphone, labelKey: 'nav.phones', customIcon: null, module: 'phones' },
  { path: '/dashboard/vehicles', icon: Car, labelKey: 'nav.vehicles', customIcon: null, module: 'vehicles' },
  { path: '/dashboard/entities', icon: TaxIcon, labelKey: 'nav.taxes', customIcon: null, module: 'entities' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { canSection } = usePermissions();

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => !item.module || canSection(item.module)),
    [canSection]
  );
  const [linkedAvatarUrl, setLinkedAvatarUrl] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const imagePath = user?.userType === 'free' ? user?.avatarPath : user?.linkedEntityImagePath;
    if (!imagePath || !window.electronAPI?.fileGetImageUrl) {
      setLinkedAvatarUrl(null);
      return;
    }
    let cancelled = false;
    window.electronAPI.fileGetImageUrl(imagePath).then((r: { success?: boolean; url?: string }) => {
      if (!cancelled && r?.success && r.url) setLinkedAvatarUrl(r.url);
      else if (!cancelled) setLinkedAvatarUrl(null);
    }).catch(() => { if (!cancelled) setLinkedAvatarUrl(null); });
    return () => { cancelled = true; };
  }, [user?.userType, user?.avatarPath, user?.linkedEntityImagePath]);

  return (
    <aside className="w-64 min-w-[16rem] shrink-0 bg-white border-l border-dark-charcoal/10 flex flex-col h-full shadow-[2px_0_8px_rgba(0,0,0,0.05)] z-20">
      <div className="py-6 px-4 border-b border-dark-charcoal/10 shrink-0 flex items-center justify-center">
        <img 
          src="./assets/alredaa_logo.png" 
          alt={t('app.titleShort')} 
          className="w-full max-w-[180px] h-auto object-contain" 
        />
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
        <ul className="space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isHome = item.path === '/dashboard';
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-gold text-white font-bold shadow-md transform scale-[1.02]'
                        : 'text-dark-charcoal hover:bg-light-background hover:text-primary-gold font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isHome ? (
                        <HomeMainIcon size={20} className="shrink-0 text-current" />
                      ) : item.customIcon === 'owner' ? (
                        <OwnerIcon isActive={isActive} alt={t('nav.employers')} />
                      ) : (
                        Icon && <Icon size={20} className="shrink-0" />
                      )}
                      <span className="min-w-0">{t(item.labelKey)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="w-full p-4 border-t border-dark-charcoal/10 shrink-0 bg-light-background/50 text-right hover:bg-primary-gold/5 transition-colors"
        aria-label={t('profile.openProfile')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-gold flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
            {linkedAvatarUrl ? (
              <img src={linkedAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.fullName?.charAt(0) ?? ''
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-dark-charcoal truncate">
              {user?.fullName}
            </p>
            <p className="text-xs text-dark-charcoal/60 truncate">
              {user?.linkedProfession || user?.linkedBranchName
                ? [user?.linkedProfession, user?.linkedBranchName].filter(Boolean).join(' · ')
                : user?.role}
            </p>
          </div>
        </div>
      </button>
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
