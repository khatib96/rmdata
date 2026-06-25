/** Platform-aware user-facing location messages (Arabic). */

export type LocationPlatform = 'darwin' | 'win32' | 'other';

export function detectLocationPlatform(): LocationPlatform {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'darwin';
  if (/Windows/i.test(ua)) return 'win32';
  return 'other';
}

export function getLocationErrorMessage(platform: LocationPlatform = detectLocationPlatform()): string {
  if (platform === 'darwin') {
    return 'تعذر تحديد الموقع — فعّل خدمة الموقع لـ RMDATA من: إعدادات النظام ← الخصوصية والأمان ← خدمات الموقع';
  }
  if (platform === 'win32') {
    return 'تعذر تحديد الموقع — يرجى تفعيل خدمة الموقع في إعدادات Windows';
  }
  return 'تعذر تحديد الموقع — يرجى تفعيل خدمة الموقع في إعدادات النظام';
}

export function getLocationOkHint(city: string | undefined, platform: LocationPlatform = detectLocationPlatform()): string {
  if (city) return `الموقع الجغرافي: ${city}`;
  if (platform === 'darwin') return 'الموقع مأخوذ من خدمة الموقع في macOS';
  if (platform === 'win32') return 'الموقع مأخوذ من خدمة Windows';
  return 'تم تحديد الموقع';
}

export function getLocationFallbackHint(city: string | undefined): string {
  return city ? `الموقع (آخر موقع معروف): ${city}` : 'الموقع مأخوذ من آخر موقع معروف';
}

export async function detectLocationPlatformAsync(): Promise<LocationPlatform> {
  try {
    const p = await window.electronAPI?.getProcessPlatform?.();
    if (p === 'darwin' || p === 'win32') return p;
  } catch {
    /* ignore */
  }
  return detectLocationPlatform();
}
