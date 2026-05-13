/**
 * دوال يستدعيها الـ main process للفحص الدوري وإشعارات سطح المكتب.
 * تعتمد على أن notifications-ipc قد سجّل الـ IPC handlers (للاستعلامات).
 */
import { AppDataSource } from '../src/database/data-source';
import { runEnsureExpiryReminders, getUnreadCount } from './ipc/notifications-ipc';
import { getLocalSetting } from './local-settings-store';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // ساعة

/** يشغّل التأكد من التنبيهات ثم يُرجع عدد غير المقروءة */
export async function runCheckAndGetUnreadCount(): Promise<number> {
  try {
    await runEnsureExpiryReminders();
    return await getUnreadCount();
  } catch (e) {
    console.warn('notification-background runCheckAndGetUnreadCount', e);
    return 0;
  }
}

/** يقرأ إعداد desktopNotificationsEnabled من الإعدادات المحلية */
export async function isDesktopNotificationsEnabled(): Promise<boolean> {
  try {
    const v = getLocalSetting('desktopNotificationsEnabled');
    return (v ?? '1') === '1';
  } catch {
    return true;
  }
}

/** يقرأ إعداد notificationSoundEnabled من الإعدادات المحلية */
export async function isNotificationSoundEnabled(): Promise<boolean> {
  try {
    const v = getLocalSetting('notificationSoundEnabled');
    return (v ?? '1') === '1';
  } catch {
    return true;
  }
}

export { CHECK_INTERVAL_MS };
