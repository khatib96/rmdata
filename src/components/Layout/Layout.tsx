import { useState, useEffect, ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileTopBar from './MobileTopBar';
import MobileDrawer from './MobileDrawer';
import BottomNav from './BottomNav';
import NotificationCenter from './NotificationCenter';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useLanguageStore } from '../../store/languageStore';
import { getSetting } from '../../services/settingsService';
import { SETTINGS_KEYS } from '../../constants/settingsKeys';
import type { UiLanguage } from '../../store/languageStore';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { dir, setLanguage } = useLanguageStore();

  // Phase 1: sync UI language from settings when dashboard loads
  useEffect(() => {
    getSetting(SETTINGS_KEYS.DEFAULT_LANGUAGE).then((saved) => {
      if (saved === 'ar' || saved === 'en') setLanguage(saved as UiLanguage);
    });
  }, [setLanguage]);

  // Apply dir and lang to document (for modals and full-page RTL/LTR)
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', dir);
    root.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
  }, [dir]);

  return (
    <div className="flex h-screen bg-light-background overflow-hidden" dir={dir}>
      {/* Desktop (عرض ≥ 1024px): القائمة الجانبية (قائمة الخدمات) + الشريط العلوي (قائمة الأدوات) */}
      <div className="hidden lg:flex lg:shrink-0 lg:w-64 lg:min-w-[16rem]">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Desktop: TopBar */}
        <div className="hidden lg:block">
          <TopBar />
        </div>

        {/* Mobile: TopBar (hamburger R, notification + profile L) */}
        {isMobile && (
          <>
            <MobileTopBar
              onMenuClick={() => setDrawerOpen((o) => !o)}
              onNotificationClick={() => setNotificationOpen(true)}
              isDrawerOpen={drawerOpen}
            />
          </>
        )}

        <main
          className={`flex-1 overflow-y-auto p-4 lg:p-6 ${
            isMobile ? 'pb-24' : ''
          }`}
          style={isMobile ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' } : undefined}
        >
          {children}
        </main>
      </div>

      {/* Mobile: Drawer (admin + main nav) */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Mobile: Bottom Nav (fixed) */}
      <BottomNav />

      {/* Notifications: FAB on desktop; controlled from MobileTopBar on mobile */}
      <NotificationCenter
        externalOpen={isMobile ? notificationOpen : undefined}
        onExternalOpenChange={isMobile ? setNotificationOpen : undefined}
      />
    </div>
  );
}
