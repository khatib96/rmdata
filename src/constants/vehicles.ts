/**
 * Vehicle constants — RMV (Professional Vehicles Management)
 * Gold/Dark theme, Arabic labels, RTL.
 */

/** قيم عمود vehicles.vehicleType — مصدر واحد مع الـ entity */
export const VehicleType = {
  BUS: 'bus',
  PICKUP: 'pickup',
  SUV: 'suv',
  SEDAN: 'sedan',
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const VEHICLE_TYPES = [
  { value: 'bus', label: 'باص' },
  { value: 'pickup', label: 'بيك أب' },
  { value: 'suv', label: 'دفع رباعي' },
  { value: 'sedan', label: 'سيدان' },
] as const;

export type VehicleTypeValue = (typeof VEHICLE_TYPES)[number]['value'];

export const OWNERSHIP_TYPES = [
  { value: 'company', label: 'شركة' },
  { value: 'personal', label: 'شخصي' },
] as const;

export type OwnershipTypeValue = (typeof OWNERSHIP_TYPES)[number]['value'];

export const INSURANCE_TYPES = [
  { value: 'comprehensive', label: 'شامل' },
  { value: 'third_party', label: 'ضد الغير' },
] as const;

export type InsuranceTypeValue = (typeof INSURANCE_TYPES)[number]['value'];

/** قائمة ماركات المركبات — مفاتيح للترجمة */
export const VEHICLE_BRAND_KEYS = [
  'toyota', 'nissan', 'hyundai', 'kia', 'chevrolet', 'ford', 'jeep', 'mercedes', 'bmw', 'audi',
  'volkswagen', 'mazda', 'mitsubishi', 'honda', 'lexus', 'infiniti', 'jaguar', 'land_rover', 'renault', 'peugeot',
  'dodge', 'ram', 'gmc', 'cadillac', 'fiat', 'other',
] as const;

export type VehicleBrandKey = (typeof VEHICLE_BRAND_KEYS)[number];

/** للتوافق مع البيانات القديمة المخزنة بالنص العربي */
export const AR_BRAND_TO_KEY: Record<string, VehicleBrandKey> = {
  'تويوتا': 'toyota', 'نيسان': 'nissan', 'هيونداي': 'hyundai', 'هيونداى': 'hyundai', 'كيا': 'kia',
  'شيفروليه': 'chevrolet', 'فورد': 'ford', 'جيب': 'jeep', 'مرسيدس': 'mercedes', 'بي إم دبليو': 'bmw',
  'أودي': 'audi', 'أودى': 'audi', 'فولكس واجن': 'volkswagen', 'مازدا': 'mazda', 'ميتسوبيشي': 'mitsubishi',
  'هوندا': 'honda', 'لكزس': 'lexus', 'الكزس': 'lexus', 'إنفينيتي': 'infiniti', 'جاكوار': 'jaguar',
  'لاند روفر': 'land_rover', 'رينو': 'renault', 'بيجو': 'peugeot', 'دودج': 'dodge', 'رام': 'ram',
  'جي إم سي': 'gmc', 'كاديلاك': 'cadillac', 'فيات': 'fiat', 'أخرى': 'other',
};
