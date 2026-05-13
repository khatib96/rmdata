import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, X, AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { NotificationSeverity, type NotificationItem } from '../../types/shared';
import { getAllSettings, SETTINGS_KEYS } from '../../services/settingsService';

interface NotificationCenterProps {
  /** When true, open state is controlled by parent (e.g. mobile header bell). FAB is hidden. */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function NotificationCenter({ externalOpen, onExternalOpenChange }: NotificationCenterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const [internalOpen, setInternalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const isControlled = externalOpen !== undefined && onExternalOpenChange;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = isControlled ? onExternalOpenChange : setInternalOpen;
  const showFab = !isControlled;

  const loadNotifications = useCallback(async () => {
    if (window.electronAPI?.notificationsEnsureAllExpiryReminders) {
      await window.electronAPI.notificationsEnsureAllExpiryReminders();
    }
    if (window.electronAPI?.notificationsLoad) {
      const res = await window.electronAPI.notificationsLoad();
      if (res?.success && res.data) {
        const list: NotificationItem[] = res.data.map((r: Record<string, unknown>) => ({
          id: r.id as number,
          entityType: (r.entityType as string) || 'branch',
          entityId: (r.entityId as number) || 0,
          title: (r.title as string) || '',
          message: r.message as string | undefined,
          dueDate: r.dueDate ? new Date(r.dueDate as string) : undefined,
          severity: (r.severity === 'danger' ? NotificationSeverity.DANGER : r.severity === 'warning' ? NotificationSeverity.WARNING : NotificationSeverity.INFO) as NotificationSeverity,
          isRead: !!(r.isRead as boolean),
          relatedField: r.relatedField as string | undefined,
          createdAt: r.createdAt ? new Date(r.createdAt as string) : new Date(),
        }));
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.isRead).length);
        return;
      }
    }
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    getAllSettings().then((s) => {
      if (!cancelled) setSoundEnabled((s[SETTINGS_KEYS.NOTIFICATION_SOUND_ENABLED] ?? '1') === '1');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const api = window.electronAPI?.onNotificationNewAlerts;
    if (!api) return;
    const unsubscribe = api((count: number) => {
      if (count > 0 && soundEnabled) {
        try {
          const audio = new Audio('/assets/notification.mp3');
          audio.play().catch(() => {});
        } catch {}
      }
    });
    return unsubscribe;
  }, [soundEnabled]);

  useEffect(() => {
    const unsub = window.electronAPI?.onUpdateStatus?.((status) => {
      // Re-trigger sound and red badge for any positive update state to ensure it's not missed
      if (status.stage === 'available' || status.stage === 'downloaded') {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === -999)) return prev; // Already exists
          const updateNotif: NotificationItem = {
            id: -999,
            entityType: 'system',
            entityId: 0,
            title: t('app.updateAvailable', { defaultValue: 'تحديث للنظام' }),
            message: status.stage === 'downloaded' 
              ? 'التحديث جاهز، انقر هنا لتثبيته وإعادة التشغيل' 
              : 'يوجد تحديث متوفر يرجى التحديث',
            severity: NotificationSeverity.INFO,
            isRead: false,
            createdAt: new Date(),
          };
          return [updateNotif, ...prev];
        });
        setUnreadCount((c) => c + 1);
        if (soundEnabled) {
          try {
            const audio = new Audio('/assets/notification.mp3');
            audio.play().catch(() => {});
          } catch {}
        }
      }
    });

    // Optionally ping the main process to ask for an update check passively 
    // to ensure the event isn't missed after mount
    setTimeout(() => {
      window.electronAPI?.checkForUpdates?.().catch(() => {});
    }, 10000);

    return () => { unsub?.(); };
  }, [soundEnabled, t]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen || isControlled) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isControlled, setIsOpen]);

  // Close on route change
  useEffect(() => {
    if (isOpen && !isControlled) {
      setIsOpen(false);
    }
  }, [location.pathname, isControlled]);

  const handleMarkRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.electronAPI?.notificationsMarkRead) return;
    const ok = await window.electronAPI.notificationsMarkRead(id);
    if (ok?.success) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (!window.electronAPI?.notificationsMarkAllRead) return;
    const ok = await window.electronAPI.notificationsMarkAllRead();
    if (ok?.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const getNavigatePath = (n: NotificationItem): string | null => {
    switch (n.entityType) {
      case 'branch':
        return `/dashboard/branches/${n.entityId}`;
      case 'vehicle':
        return `/dashboard/vehicles/${n.entityId}`;
      case 'employee':
        return `/dashboard/employees/${n.entityId}`;
      case 'housing':
        return `/dashboard/housing/${n.entityId}`;
      case 'employer':
        return `/dashboard/employers/${n.entityId}`;
      case 'entity':
        return `/dashboard/entities/${n.entityId}`;
      default:
        return null;
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (n.entityType === 'system') {
      setIsOpen(false);
      navigate('/dashboard/settings/about');
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      setUnreadCount((c) => Math.max(0, c - 1));
      return;
    }
    
    if (!n.isRead && window.electronAPI?.notificationsMarkRead) {
      await window.electronAPI.notificationsMarkRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    const path = getNavigatePath(n);
    if (path) {
      setIsOpen(false);
      navigate(path);
    }
  };

  const getSeverityIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case NotificationSeverity.DANGER:
        return <AlertCircle className="text-alert-red" size={20} />;
      case NotificationSeverity.WARNING:
        return <AlertTriangle className="text-yellow-600" size={20} />;
      default:
        return <Info className="text-success-green" size={20} />;
    }
  };

  /**
   * Translate key-based title/message stored as `key1::key2::extra`.
   * Falls back to raw text for legacy notifications without `::`.
   */
  const translateField = (raw: string | undefined, kind: 'title' | 'message'): string => {
    if (!raw) return '';
    if (!raw.includes('::')) return raw;

    const parts = raw.split('::');

    if (kind === 'title') {
      const docKey = parts[0];
      const statusKey = parts[1] || 'expiry';
      const extra = parts[2] || '';

      if (docKey === 'customField' && extra) {
        return `${extra}: ${t(`notifications.status.${statusKey}`)}`;
      }

      if (docKey === 'tradeLicenseNamed') {
        const name = parts[1] || '';
        const status = parts[2] || 'expiry';
        return `${t('notifications.docs.tradeLicenseNamed', { name })}: ${t(`notifications.status.${status}`)}`;
      }

      const docLabel = t(`notifications.docs.${docKey}`, { defaultValue: docKey });
      const statusLabel = t(`notifications.status.${statusKey}`, { defaultValue: statusKey });
      return `${docLabel}: ${statusLabel}`;
    }

    const msgKey = parts[0];
    if (msgKey === 'installmentMsg') {
      return t('notifications.messages.installmentMsg', {
        amount: parts[1] || '',
        date: parts[2] || '',
        branch: parts[3] || '',
      });
    }
    if (msgKey === 'branchMsg') {
      return t('notifications.messages.branchMsg', {
        name: parts[1] || '',
        date: parts[2] || '',
      });
    }
    if (msgKey === 'entityMsg') {
      return t('notifications.messages.entityMsg', {
        name: parts[1] || '',
        date: parts[2] || '',
      });
    }

    return raw;
  };

  const getCardStyle = (notification: NotificationItem) => {
    if (notification.isRead) {
      return 'bg-white border-l-secondary-gray/40 border border-secondary-gray/30';
    }
    switch (notification.severity) {
      case NotificationSeverity.DANGER:
        return 'border-l-alert-red bg-red-50 border border-red-100';
      case NotificationSeverity.WARNING:
        return 'border-l-yellow-500 bg-yellow-50 border border-yellow-100';
      default:
        return 'border-l-success-green bg-green-50 border border-green-100';
    }
  };

  return (
    <>
      {showFab && (
        <button
          ref={fabRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={t('notifications.bellLabel')}
          className="fixed bottom-20 left-6 w-14 h-14 bg-primary-gold rounded-full shadow-lg flex items-center justify-center text-white hover:bg-accent-sand transition-colors z-50 min-w-[44px] min-h-[44px]"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-alert-red rounded-full flex items-center justify-center text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`fixed z-50 bg-white rounded-lg shadow-2xl flex flex-col ${
            isControlled
              ? 'inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] max-h-[85vh]'
              : 'bottom-24 left-6 w-96 max-h-[600px]'
          }`}
        >
          <div className="p-4 border-b border-secondary-gray flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-dark-charcoal">{t('notifications.title')}</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-sm text-primary-gold hover:underline"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-dark-charcoal/60 hover:text-dark-charcoal p-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <p className="text-center text-secondary-gray py-8">{t('notifications.empty')}</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
                  className={`p-4 rounded-lg border-l-4 cursor-pointer transition-colors ${getCardStyle(notification)} ${
                    !notification.isRead ? 'ring-2 ring-primary-gold/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notification.isRead ? (
                      <span className="text-secondary-gray/60" aria-hidden>
                        <Check size={20} />
                      </span>
                    ) : (
                      getSeverityIcon(notification.severity)
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-dark-charcoal mb-1">{translateField(notification.title, 'title')}</h4>
                      <p className="text-sm text-dark-charcoal/70 mb-2">{translateField(notification.message, 'message')}</p>
                      {notification.dueDate && (
                        <p className="text-xs text-dark-charcoal/50">
                          {notification.dueDate.toLocaleDateString('en', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={(e) => handleMarkRead(e, notification.id)}
                        className="shrink-0 p-2 rounded-lg hover:bg-white/70 text-primary-gold border border-primary-gold/30"
                        title={t('notifications.markAsRead')}
                      >
                        <Check size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
