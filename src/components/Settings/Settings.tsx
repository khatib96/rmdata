import { useState, useEffect, useMemo } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { SETTINGS_SECTIONS, getSectionByPath } from './SettingsSections';
import { isSettingsApiAvailable } from '../../services/settingsService';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import GeneralSettings from './sections/GeneralSettings';
import LanguageSettings from './sections/LanguageSettings';
import UsersSettings from './sections/UsersSettings';
import NotificationsSettings from './sections/NotificationsSettings';
import DatabaseSettings from './sections/DatabaseSettings';
import BackupSettings from './sections/BackupSettings';
import AboutSettings from './sections/AboutSettings';
import UserPermissionsSettings from './sections/UserPermissionsSettings';
import ConnectedDevicesSettings from './sections/ConnectedDevicesSettings';

const SECTION_COMPONENTS: Record<string, () => JSX.Element> = {
  general: GeneralSettings,
  language: LanguageSettings,
  users: UsersSettings,
  userPermissions: UserPermissionsSettings,
  notifications: NotificationsSettings,
  database: DatabaseSettings,
  devices: ConnectedDevicesSettings,
  backup: BackupSettings,
  about: AboutSettings,
};

export default function Settings() {
  const { t } = useTranslation();
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const userRoleId = useAuthStore((s) => s.user?.roleId);
  const isAdmin = userRoleId === 1;
  const { can: canByPermission } = usePermissions();
  const sectionDef = section ? getSectionByPath(section) : null;
  const SectionContent = section && SECTION_COMPONENTS[section] ? SECTION_COMPONENTS[section] : null;

  const visibleSections = useMemo(() => {
    return SETTINGS_SECTIONS.filter((s) => {
      if (isAdmin) return true; // Admin sees everything
      // Each settings sub-section uses settings:sub.{id}
      if (s.id === 'devices') return canByPermission('settings', 'sub.devices');
      if (s.id === 'userPermissions') return canByPermission('settings', 'sub.permissions');
      if (s.id === 'users') return canByPermission('settings', 'sub.users') || canByPermission('settings', 'users.view');
      if (s.id === 'database') return canByPermission('settings', 'sub.database');
      if (s.id === 'backup') return canByPermission('settings', 'sub.backup');
      if (s.id === 'notifications') return canByPermission('settings', 'sub.notifications');
      if (s.id === 'general') return canByPermission('settings', 'sub.general');
      if (s.id === 'language') return canByPermission('settings', 'sub.language');
      if (s.id === 'about') return canByPermission('settings', 'view');
      return canByPermission('settings', 'view');
    });
  }, [isAdmin, canByPermission]);

  const canAccessCurrentSection = useMemo(() => {
    if (!sectionDef) return false;
    return visibleSections.some((s) => s.id === sectionDef.id);
  }, [sectionDef, visibleSections]);

  useEffect(() => {
    isSettingsApiAvailable().then(setApiAvailable);
  }, []);

  return (
    <div className="flex flex-col h-full bg-light-background animate-in fade-in duration-200">
      <div className="shrink-0 px-4 sm:px-6 pb-2 pt-4 sm:pt-6">
        <h1 className="text-xl sm:text-2xl font-bold text-dark-charcoal flex items-center gap-2">
          <SettingsIcon size={28} className="text-primary-gold shrink-0" />
          {t('settings.title')}
        </h1>
        {apiAvailable === false && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800" role="alert">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-sm">{t('settings.electronUnavailable')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 p-4 sm:p-6 pt-2 sm:pt-4 gap-4 lg:gap-6">
        {/* Sidebar: على الموبايل يظهر كقائمة أفقية قابلة للتمرير، على الديسكتوب عمود ثابت */}
        <aside className="lg:w-56 shrink-0">
          <nav className="bg-white rounded-lg border border-secondary-gray shadow-sm overflow-hidden">
            <ul className="flex lg:flex-col overflow-x-auto no-scrollbar lg:overflow-visible p-2 gap-1 lg:gap-0">
              {visibleSections.map((s) => {
                const Icon = s.icon;
                const to = `/dashboard/settings/${s.path}`;
                return (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-primary-gold/15 text-primary-gold font-medium'
                            : 'text-dark-charcoal hover:bg-secondary-gray/20'
                        }`
                      }
                    >
                      <Icon size={20} className="shrink-0" />
                      <span className="text-sm">{t(s.labelKey)}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* المحتوى: عرض كامل العرض على الموبايل */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {!section ? (
            <div className="bg-white rounded-lg border border-secondary-gray shadow-sm p-4 sm:p-6">
              <p className="text-secondary-gray mb-4 sm:mb-6 text-sm sm:text-base break-words">
                {t('settings.chooseSection')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {visibleSections.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/dashboard/settings/${s.path}`)}
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-secondary-gray hover:border-primary-gold hover:bg-primary-gold/5 text-right transition-colors"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-gold/15 flex items-center justify-center shrink-0">
                        <Icon size={24} className="text-primary-gold" />
                      </div>
                      <span className="font-medium text-dark-charcoal text-sm sm:text-base min-w-0 break-words text-right">{t(s.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : SectionContent && canAccessCurrentSection ? (
            <div className="bg-white rounded-lg border border-secondary-gray shadow-sm p-4 sm:p-6">
              <SectionContent />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-secondary-gray shadow-sm p-4 sm:p-6">
              <p className="text-secondary-gray">{t('settings.unknownSection')}</p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/settings')}
                className="mt-4 text-primary-gold hover:underline"
              >
                {t('settings.backToSettings')}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
