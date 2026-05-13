/**
 * UAE-specific constants - System is hardcoded for UAE operations only.
 */

export const UAE_COUNTRY = 'United Arab Emirates';
export const UAE_COUNTRY_AR = 'الإمارات العربية المتحدة';

export const UAE_EMIRATES = [
  { value: 'dubai', label: 'دبي', labelEn: 'Dubai' },
  { value: 'abu_dhabi', label: 'أبوظبي', labelEn: 'Abu Dhabi' },
  { value: 'sharjah', label: 'الشارقة', labelEn: 'Sharjah' },
  { value: 'ajman', label: 'عجمان', labelEn: 'Ajman' },
  { value: 'rak', label: 'رأس الخيمة', labelEn: 'Ras Al Khaimah' },
  { value: 'uaq', label: 'أم القيوين', labelEn: 'Umm Al Quwain' },
  { value: 'fujairah', label: 'الفجيرة', labelEn: 'Fujairah' },
] as const;

/** Returns the emirate label in the requested language (uses labelEn when lang is 'en'). */
export function getEmirateLabel(value: string, lang?: 'ar' | 'en'): string {
  const found = UAE_EMIRATES.find((e) => e.value === value);
  if (!found) return value;
  const withEn = found as { value: string; label: string; labelEn?: string };
  if (lang === 'en' && withEn.labelEn) return withEn.labelEn;
  return found.label;
}
