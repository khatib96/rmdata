import React, { useState } from 'react';
import { Smartphone, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_SOURCES: Record<string, string> = {
  mobile: './icons/mobile.png',
  landline: './icons/Landline_phone.png',
};

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone,
  landline: Phone,
};

export interface PhoneIconProps {
  size?: number;
  className?: string;
}

function createPhoneIcon(key: string) {
  const src = ICON_SOURCES[key];
  const Fallback = FALLBACK_ICONS[key];
  return function PhoneTypeIcon({ size = 24, className = '' }: PhoneIconProps) {
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

export const MobileIcon = createPhoneIcon('mobile');
export const LandlineIcon = createPhoneIcon('landline');

export const PHONE_ICON_MAP: Record<string, React.ComponentType<PhoneIconProps>> = {
  mobile: MobileIcon,
  landline: LandlineIcon,
};
