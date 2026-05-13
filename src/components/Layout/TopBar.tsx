import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { LogOut, Archive, Settings, FolderOpen, ScrollText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';



export default function TopBar() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const { canSection } = usePermissions();

  const topBarItems = useMemo(() => {
    const all: { path: string; icon: typeof FolderOpen; labelKey: string; module: string | null }[] = [
      { path: '/dashboard/documents', icon: FolderOpen, labelKey: 'nav.documents', module: 'documents' },
      { path: '/dashboard/archive', icon: Archive, labelKey: 'nav.archive', module: null },
      { path: '/dashboard/logs', icon: ScrollText, labelKey: 'nav.systemLog', module: 'logs' },
      { path: '/dashboard/settings', icon: Settings, labelKey: 'nav.settings', module: 'settings' },
    ];
    return all.filter((item) => !item.module || canSection(item.module));
  }, [canSection]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-dark-charcoal flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-6">
        {/* Spacer for structure if needed, or leave empty */}
        <div className="hidden lg:flex flex-col w-4" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {topBarItems.map((item) => {
          const Icon = item.icon;
          return (
             <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                isActive(item.path)
                  ? 'bg-primary-gold text-white shadow-md'
                  : 'text-light-background/80 hover:bg-light-background/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span className="text-xs font-medium">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-6 shrink-0 pl-2 border-r border-light-background/20 mr-4 pr-4">
        <div className="text-right">
          <p className="text-sm font-medium text-light-background">
            {new Date().toLocaleDateString(dateLocale, {
              weekday: 'long',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-alert-red hover:bg-alert-red/10 rounded-lg transition-colors border border-transparent hover:border-alert-red/30"
          title={t('nav.logout')}
        >
          <LogOut size={18} />
          <span className="text-sm font-medium hidden sm:inline">{t('nav.logout')}</span>
        </button>
      </div>
    </header>
  );
}
