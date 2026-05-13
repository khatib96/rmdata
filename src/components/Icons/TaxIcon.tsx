import { useState } from 'react';
import { Percent } from 'lucide-react';

const TAX_ICON_SRC = './icons/tax-icon.png';

/** الذهبي الخاص بالبرنامج (نفس لون اسم الكيان والأزرار) */
const BRAND_GOLD = '#A37A3F';

interface TaxIconProps {
  size?: number;
  className?: string;
  /** تطبيق الذهبي الخاص بالبرنامج على الأيقونة (قناع + لون) */
  golden?: boolean;
}

/** أيقونة الضرائب: صورة مخصصة من public/icons مع ارتداد إلى % إذا فشل التحميل */
export default function TaxIcon({ size = 24, className = '', golden = false }: TaxIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Percent size={size} className={className} />;
  }

  const maskStyle = {
    width: size,
    height: size,
    display: 'inline-block' as const,
    backgroundColor: golden ? BRAND_GOLD : 'currentColor',
    WebkitMaskImage: `url(${TAX_ICON_SRC})`,
    WebkitMaskSize: 'contain' as const,
    WebkitMaskRepeat: 'no-repeat' as const,
    WebkitMaskPosition: 'center' as const,
    maskImage: `url(${TAX_ICON_SRC})`,
    maskSize: 'contain' as const,
    maskRepeat: 'no-repeat' as const,
    maskPosition: 'center' as const,
  };

  return (
    <>
      <span className={className} style={maskStyle} />
      <img src={TAX_ICON_SRC} alt="" width={0} height={0} className="hidden" onError={() => setFailed(true)} />
    </>
  );
}
