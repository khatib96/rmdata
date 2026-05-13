import type { ComponentType } from 'react';
import { PROFESSION_ICON_MAP } from '../components/Icons/ProfessionIcons';

/**
 * الوظائف — اختيار وظيفة واحدة (راديو). الاستثناء: إذا اختار "سائق" يمكن إضافة وظيفة ثانية واحدة.
 * الأيقونات من src/components/Icons/ProfessionIcons (صور في public/icons).
 */
export type ProfessionKey =
  | 'admin'
  | 'driver'
  | 'salesman'
  | 'cutter'
  | 'tailor'
  | 'ironing'
  | 'maintenance'
  | 'other';

export interface ProfessionOption {
  key: ProfessionKey;
  label: string;
  hasCustomTitle?: boolean;
  canCombine?: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/** ترتيب العرض: إداري، سائق، بائع، قصاص، خياط، كوي، تشطيب، أخرى */
export const PROFESSIONS: ProfessionOption[] = [
  { key: 'admin', label: 'إداري', hasCustomTitle: true, canCombine: true, icon: PROFESSION_ICON_MAP.admin },
  { key: 'driver', label: 'سائق', canCombine: true, icon: PROFESSION_ICON_MAP.driver },
  { key: 'salesman', label: 'بائع', canCombine: false, icon: PROFESSION_ICON_MAP.salesman },
  { key: 'cutter', label: 'قصاص', canCombine: false, icon: PROFESSION_ICON_MAP.cutter },
  { key: 'tailor', label: 'خياط', canCombine: false, icon: PROFESSION_ICON_MAP.tailor },
  { key: 'ironing', label: 'كوي', canCombine: false, icon: PROFESSION_ICON_MAP.ironing },
  { key: 'maintenance', label: 'تشطيب', canCombine: false, icon: PROFESSION_ICON_MAP.maintenance },
  { key: 'other', label: 'أخرى', hasCustomTitle: true, canCombine: false, icon: PROFESSION_ICON_MAP.other },
];
