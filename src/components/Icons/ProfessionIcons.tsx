import React, { useState } from 'react';
import { Briefcase, Car, ShoppingCart, Scissors, Shirt, Flame, Wrench, CircleDot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * أيقونات الوظائف — صور من public/icons مع ارتداد إلى Lucide عند فشل التحميل.
 */
const ICON_SOURCES: Record<string, string> = {
  admin: './icons/manger.png',
  driver: './icons/driver.png',
  salesman: './icons/enterpreneur.png',
  cutter: './icons/cutting.png',
  tailor: './icons/tailor.png',
  ironing: './icons/man-ironing.png',
  maintenance: './icons/packing.png',
  other: './icons/prof-other.png',
};

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  admin: Briefcase,
  driver: Car,
  salesman: ShoppingCart,
  cutter: Scissors,
  tailor: Shirt,
  ironing: Flame,
  maintenance: Wrench,
  other: CircleDot,
};

export interface ProfessionIconProps {
  size?: number;
  className?: string;
}

function createProfessionIcon(key: string) {
  const src = ICON_SOURCES[key];
  const Fallback = FALLBACK_ICONS[key];
  return function ProfessionIcon({ size = 24, className = '' }: ProfessionIconProps) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) {
      return Fallback ? <Fallback size={size} className={className} /> : null;
    }
    return (
      <>
        <span
          className={className}
          style={{
            width: size,
            height: size,
            display: 'inline-block',
            backgroundColor: 'currentColor',
            WebkitMaskImage: `url(${src})`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: `url(${src})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
          }}
        />
        <img src={src} alt="" width={0} height={0} className="hidden" onError={() => setFailed(true)} />
      </>
    );
  };
}

export const AdminIcon = createProfessionIcon('admin');
export const DriverIcon = createProfessionIcon('driver');
export const SalesmanIcon = createProfessionIcon('salesman');
export const CutterIcon = createProfessionIcon('cutter');
export const TailorIcon = createProfessionIcon('tailor');
export const IroningIcon = createProfessionIcon('ironing');
export const FinishingIcon = createProfessionIcon('maintenance');
export const OtherProfessionIcon = createProfessionIcon('other');

/** خريطة مفتاح الوظيفة → مكوّن الأيقونة (للتوافق مع واجهة size + className) */
export const PROFESSION_ICON_MAP: Record<string, React.ComponentType<ProfessionIconProps>> = {
  admin: AdminIcon,
  driver: DriverIcon,
  salesman: SalesmanIcon,
  cutter: CutterIcon,
  tailor: TailorIcon,
  ironing: IroningIcon,
  maintenance: FinishingIcon,
  other: OtherProfessionIcon,
};
