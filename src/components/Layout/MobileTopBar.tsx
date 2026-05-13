import { Menu, Bell, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

const SAFE_TOP = 'pt-[env(safe-area-inset-top)]';
const MIN_TOUCH = 'min-w-[44px] min-h-[44px]';

interface MobileTopBarProps {
  onMenuClick: () => void;
  onNotificationClick: () => void;
  isDrawerOpen?: boolean;
}

export default function MobileTopBar({
  onMenuClick,
  onNotificationClick,
  isDrawerOpen,
}: MobileTopBarProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <header
      className={`lg:hidden h-14 ${SAFE_TOP} pl-4 pr-4 pb-3 pt-3 bg-dark-charcoal flex items-center justify-between shadow-sm z-40`}
    >
      {/* Right (RTL): Hamburger */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t('layout.openMenu')}
        className={`flex items-center justify-center rounded-lg text-light-background transition-colors ${MIN_TOUCH} ${
          isDrawerOpen ? 'bg-primary-gold' : 'hover:bg-dark-charcoal/80'
        }`}
      >
        {isDrawerOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Center: Title (short on mobile) */}
      <img 
        src="./assets/alredaa_logo.png" 
        alt={t('app.brandAlt')} 
        className="h-12 w-auto object-contain py-1" 
      />

      {/* Left (RTL): Notification + Profile */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNotificationClick}
          aria-label={t('notifications.bellLabel')}
          className={`flex items-center justify-center rounded-full ${MIN_TOUCH} text-light-background hover:bg-dark-charcoal/80 transition-colors`}
        >
          <Bell size={22} />
        </button>
        <div
          className={`flex items-center justify-center rounded-full bg-primary-gold text-white font-bold shrink-0 w-11 h-11 ${MIN_TOUCH}`}
          aria-hidden
        >
          {user?.fullName?.charAt(0) || '?'}
        </div>
      </div>
    </header>
  );
}
