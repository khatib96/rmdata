/**
 * مفاتيح إعدادات النظام — استخدام ثابت لتجنب نصوص مبعثرة
 */
export const SETTINGS_KEYS = {
  COMPANY_NAME: 'companyName',
  LOGO_PATH: 'logoPath',
  DEFAULT_LANGUAGE: 'defaultLanguage',
  TIMEZONE: 'timezone',
  DATE_FORMAT: 'dateFormat',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  NOTIFICATION_SOUND_ENABLED: 'notificationSoundEnabled',
  DESKTOP_NOTIFICATIONS_ENABLED: 'desktopNotificationsEnabled',
  EXPIRY_WARNING_DAYS: 'expiryWarningDays',
  SHOW_GREEN_EXPIRY: 'showGreenExpiry',
  SHOW_YELLOW_EXPIRY: 'showYellowExpiry',
  AUTO_BACKUP_ENABLED: 'autoBackupEnabled',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export const DEFAULT_VALUES: Record<string, string> = {
  [SETTINGS_KEYS.COMPANY_NAME]: 'الرداء الموحد',
  [SETTINGS_KEYS.DEFAULT_LANGUAGE]: 'ar',
  [SETTINGS_KEYS.TIMEZONE]: 'Asia/Dubai',
  [SETTINGS_KEYS.DATE_FORMAT]: 'yyyy-MM-dd',
  [SETTINGS_KEYS.NOTIFICATIONS_ENABLED]: '1',
  [SETTINGS_KEYS.NOTIFICATION_SOUND_ENABLED]: '1',
  [SETTINGS_KEYS.DESKTOP_NOTIFICATIONS_ENABLED]: '1',
  [SETTINGS_KEYS.EXPIRY_WARNING_DAYS]: '30',
  [SETTINGS_KEYS.SHOW_GREEN_EXPIRY]: '1',
  [SETTINGS_KEYS.SHOW_YELLOW_EXPIRY]: '1',
  [SETTINGS_KEYS.AUTO_BACKUP_ENABLED]: '0',
};

/**
 * Settings that are device-specific and stored locally (NOT synced to remote DB).
 */
export const LOCAL_ONLY_KEYS: ReadonlySet<string> = new Set([
  SETTINGS_KEYS.DEFAULT_LANGUAGE,
  SETTINGS_KEYS.NOTIFICATIONS_ENABLED,
  SETTINGS_KEYS.NOTIFICATION_SOUND_ENABLED,
  SETTINGS_KEYS.DESKTOP_NOTIFICATIONS_ENABLED,
  SETTINGS_KEYS.SHOW_GREEN_EXPIRY,
  SETTINGS_KEYS.SHOW_YELLOW_EXPIRY,
  SETTINGS_KEYS.AUTO_BACKUP_ENABLED,
]);

