import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  FolderOpen,
  Settings,
  ScrollText,
  LogOut,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import UserProfileModal from './UserProfileModal';

const MIN_TOUCH = 'min-h-[44px]';

/** قائمة الأدوات / الإدارة (القائمة العلوية) — تظهر في هامبرغر الموبايل فقط */
const adminItems = [
  { path: '/dashboard/logs', icon: ScrollText, labelKey: 'nav.systemLog' },
  { path: '/dashboard/archive', icon: Archive, labelKey: 'nav.archive' },
  { path: '/dashboard/documents', icon: FolderOpen, labelKey: 'nav.documents' },
  { path: '/dashboard/settings', icon: Settings, labelKey: 'nav.settings' },
];

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { dir } = useLanguageStore();
  const isRtl = dir === 'rtl';
  const [profileOpen, setProfileOpen] = useState(false);
  const [linkedAvatarUrl, setLinkedAvatarUrl] = useState<string | null>(null);

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

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="presentation"
        className="lg:hidden fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`lg:hidden fixed top-0 bottom-0 w-[min(320px,85vw)] bg-white shadow-2xl z-50 flex flex-col overflow-hidden ${isRtl ? 'right-0' : 'left-0'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="p-4 border-b border-secondary-gray flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary-gold">{t('nav.adminMenu')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.close')}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary-gray/30 text-dark-charcoal"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-xs font-medium text-dark-charcoal/60 px-3 py-2">{t('nav.toolsList')}</p>
          {adminItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-dark-charcoal/80 hover:bg-secondary-gray/30 transition-colors ${MIN_TOUCH} ${isRtl ? 'text-right' : 'text-left'}`}
              >
                <Icon size={20} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-secondary-gray">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={`w-full p-4 flex items-center gap-3 hover:bg-primary-gold/5 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t('profile.openProfile')}
          >
            <div className="w-10 h-10 rounded-full bg-primary-gold flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
              {linkedAvatarUrl ? (
                <img src={linkedAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.charAt(0) || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-charcoal truncate">{user?.fullName}</p>
              <p className="text-xs text-dark-charcoal/60 truncate">
                {user?.linkedProfession || user?.linkedBranchName
                  ? [user?.linkedProfession, user?.linkedBranchName].filter(Boolean).join(' · ')
                  : user?.role}
              </p>
            </div>
          </button>
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={handleLogout}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-alert-red hover:bg-red-50 min-h-[44px] ${isRtl ? 'w-full justify-end' : 'w-full justify-start'}`}
            >
              <LogOut size={18} />
              <span className="text-sm">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
        <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      </aside>
    </>
  );
}
