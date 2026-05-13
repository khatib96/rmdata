import { useTranslation } from 'react-i18next';
import { getExpiryStatus, getExpiryBadgeClass } from '../../utils/expiryAlert';

type ExpiryNs = 'employees' | 'employers';

export interface ExpiryBadgeProps {
  dateStr?: string;
  label: string;
  /** i18n namespace for expiryExpired / expiryInDays */
  translationNs?: ExpiryNs;
  className?: string;
}

/**
 * Inline pill showing document / contract expiry relative to today (quad-color system).
 */
export function ExpiryBadge({ dateStr, label, translationNs = 'employees', className = '' }: ExpiryBadgeProps) {
  const { t } = useTranslation();
  if (!dateStr) return null;
  const info = getExpiryStatus(dateStr);
  const expiredKey = `${translationNs}.expiryExpired` as const;
  const inDaysKey = `${translationNs}.expiryInDays` as const;
  const detail = info.isExpired
    ? t(expiredKey, { count: info.daysLeft != null ? Math.abs(info.daysLeft) : 0 })
    : info.daysLeft != null && info.daysLeft > 0
      ? t(inDaysKey, { count: info.daysLeft })
      : info.label;
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getExpiryBadgeClass(info.status)} ${className}`.trim()}
    >
      {info.icon} {label}: {detail}
    </span>
  );
}
