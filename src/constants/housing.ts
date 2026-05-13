/**
 * ثوابت قسم السكن — أنواع الوحدات والعقد باسم
 * القيم المخزنة في DB: labour | family | warehouse | mixed (الواجهة تستخدم personal بدل family).
 */
export const HousingType = {
  LABOUR: 'labour',
  FAMILY: 'family',
  WAREHOUSE: 'warehouse',
  MIXED: 'mixed',
} as const;
export type HousingType = (typeof HousingType)[keyof typeof HousingType];

export const HOUSING_TYPES = [
  { value: 'warehouse', label: 'مستودع' },
  { value: 'personal', label: 'شخصي' },
  { value: 'labour', label: 'سكن عمال' },
  { value: 'mixed', label: 'مختلط' },
] as const;

export const OWNED_BY_OPTIONS = [
  { value: 'company', label: 'الشركة' },
  { value: 'employee', label: 'الموظف' },
  { value: 'employer', label: 'صاحب العمل' },
  { value: 'other', label: 'طرف ثالث' },
] as const;

export const OCCUPANT_ROLES = [
  { value: 'primary', label: 'ساكن رئيسي' },
  { value: 'occupant', label: 'ساكن' },
  { value: 'other', label: 'أخرى' },
];

/** تحويل قيمة النموذج إلى عمود housing_units.housingType */
export function housingTypeFormToDb(formValue: string): string {
  if (formValue === 'personal') return HousingType.FAMILY;
  return formValue;
}

export function getHousingTypeLabel(v: string | undefined): string {
  if (!v) return '—';
  if (v === 'family') return 'شخصي';
  const t = HOUSING_TYPES.find((x) => x.value === v);
  return t?.label ?? v;
}

export function getOwnedByLabel(v: string | undefined): string {
  if (!v) return '—';
  const o = OWNED_BY_OPTIONS.find((x) => x.value === v);
  return o?.label ?? v;
}
