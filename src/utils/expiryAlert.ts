/**
 * Quad-Color Alert System: 90/30/1 Logic
 * - Green: > 90 days
 * - Orange: <= 90 days
 * - Yellow: <= 30 days
 * - Red: Expired or < 1 day
 */

export type ExpiryStatus = 'green' | 'orange' | 'yellow' | 'red';

export interface ExpiryInfo {
  status: ExpiryStatus;
  label: string;
  icon: string;
  daysLeft: number | null;
  isExpired: boolean;
}

export function getExpiryStatus(dateStr: string | null | undefined, warningDays: number = 30): ExpiryInfo {
  if (!dateStr) {
    return { status: 'green', label: '—', icon: '✅', daysLeft: null, isExpired: false };
  }
  const expiry = new Date(String(dateStr).slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: 'red', label: 'منتهي', icon: '🔴', daysLeft, isExpired: true };
  }
  if (daysLeft <= 0) {
    return { status: 'red', label: 'ينتهي اليوم', icon: '🔴', daysLeft, isExpired: false };
  }
  if (daysLeft <= warningDays) {
    return { status: 'yellow', label: `${daysLeft} يوم`, icon: '⚠️', daysLeft, isExpired: false };
  }
  if (daysLeft <= 90) {
    return { status: 'orange', label: `${daysLeft} يوم`, icon: '🟠', daysLeft, isExpired: false };
  }
  return { status: 'green', label: 'ساري', icon: '✅', daysLeft, isExpired: false };
}

export function getExpiryBadgeClass(status: ExpiryStatus): string {
  switch (status) {
    case 'green': return 'bg-success-green/20 text-success-green';
    case 'orange': return 'bg-amber-500/20 text-amber-800';
    case 'yellow': return 'bg-yellow-400/30 text-yellow-800';
    case 'red': return 'bg-alert-red/20 text-alert-red';
    default: return 'bg-secondary-gray/20 text-dark-charcoal';
  }
}
