import { useState } from 'react';
import { Scissors } from 'lucide-react';

const WORKSHOP_ICON_SRC = './icons/Sewing-factory.png';

/** الذهبي الخاص بالبرنامج (نفس لون اسم الكيان والأزرار) */
const BRAND_GOLD = '#A37A3F';

interface WorkshopIconProps {
  size?: number;
  className?: string;
  /** تطبيق الذهبي الخاص بالبرنامج على الأيقونة (قناع + لون) */
  golden?: boolean;
}

/** أيقونة المشغل (خياطة): صورة مخصصة من public/icons مع ارتداد إلى Scissors إذا فشل التحميل */
export default function WorkshopIcon({ size = 24, className = '', golden = false }: WorkshopIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Scissors size={size} className={className} />;
  }

  const maskStyle = {
    width: size,
    height: size,
    display: 'inline-block' as const,
    backgroundColor: golden ? BRAND_GOLD : 'currentColor',
    WebkitMaskImage: `url(${WORKSHOP_ICON_SRC})`,
    WebkitMaskSize: 'contain' as const,
    WebkitMaskRepeat: 'no-repeat' as const,
    WebkitMaskPosition: 'center' as const,
    maskImage: `url(${WORKSHOP_ICON_SRC})`,
    maskSize: 'contain' as const,
    maskRepeat: 'no-repeat' as const,
    maskPosition: 'center' as const,
  };

  return (
    <>
      <span className={className} style={maskStyle} />
      <img src={WORKSHOP_ICON_SRC} alt="" width={0} height={0} className="hidden" onError={() => setFailed(true)} />
    </>
  );
}
