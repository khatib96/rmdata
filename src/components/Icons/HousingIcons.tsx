import React, { useState } from 'react';
import { Home, Building2, Warehouse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_SOURCES: Record<string, string> = {
  labour: './icons/Workers_housing.png',
  personal: './icons/Personal_home.png',
  warehouse: './icons/storehouse.png',
};

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  labour: Building2,
  personal: Home,
  warehouse: Warehouse,
};

export interface HousingIconProps {
  size?: number;
  className?: string;
}

function createHousingIcon(key: string) {
  const src = ICON_SOURCES[key];
  const Fallback = FALLBACK_ICONS[key];
  return function HousingIcon({ size = 24, className = '' }: HousingIconProps) {
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

export const LabourHousingIcon = createHousingIcon('labour');
export const PersonalHousingIcon = createHousingIcon('personal');
export const WarehouseIcon = createHousingIcon('warehouse');

export const HOUSING_ICON_MAP: Record<string, React.ComponentType<HousingIconProps>> = {
  labour: LabourHousingIcon,
  personal: PersonalHousingIcon,
  warehouse: WarehouseIcon,
};
