/** Returns: 'expired' | 'warning' | 'ok' */
export function getExpiryStatus(dateStr: string | undefined): 'expired' | 'warning' | 'ok' {
  if (!dateStr) return 'ok';
  const d = new Date(dateStr);
  const now = new Date();
  const days = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days <= 30) return 'warning';
  return 'ok';
}

export function getExpiryBadgeClass(status: 'expired' | 'warning' | 'ok'): string {
  if (status === 'expired') return 'bg-red-100 text-red-800';
  if (status === 'warning') return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}
