import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { saveLastKnownLocation, getLastKnownLocation } from '../../utils/lastKnownLocation';
import { resolveDeviceCoordinates } from '../../utils/deviceLocation';

type PrayerId = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

type Prayer = {
  id: PrayerId;
  nameAr: string;
  short: string;
  time24: string; // HH:mm (24h)
  minutes: number;
  time12?: string; // formatted label like 4:30 م
};

type Coords = { lat: number; lng: number; city?: string };

const MOSQUE_ICON_SRC = './icons/mosque.png';
const ALADHAN_METHOD = 4;

// Local UAE Emirates centers for offline detection (no API needed)
const UAE_EMIRATES: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'أبوظبي', lat: 24.4539, lng: 54.3773 },
  { name: 'دبي', lat: 25.2048, lng: 55.2708 },
  { name: 'الشارقة', lat: 25.3573, lng: 55.4033 },
  { name: 'عجمان', lat: 25.4052, lng: 55.5136 },
  { name: 'أم القيوين', lat: 25.5647, lng: 55.5554 },
  { name: 'رأس الخيمة', lat: 25.7895, lng: 55.9432 },
  { name: 'الفجيرة', lat: 25.1288, lng: 56.3265 },
];

function getClosestEmirate(lat: number, lng: number): string {
  let closest = UAE_EMIRATES[0].name;
  let minDist = Infinity;
  for (const e of UAE_EMIRATES) {
    const d = Math.sqrt(Math.pow(lat - e.lat, 2) + Math.pow(lng - e.lng, 2));
    if (d < minDist) {
      minDist = d;
      closest = e.name;
    }
  }
  return closest;
}

function MaskedIcon({ src, size = 18, className = '' }: { src: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Landmark size={size} className={className} />;
  }

  const maskStyle = {
    width: size,
    height: size,
    display: 'inline-block' as const,
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url(${src})`,
    WebkitMaskSize: 'contain' as const,
    WebkitMaskRepeat: 'no-repeat' as const,
    WebkitMaskPosition: 'center' as const,
    maskImage: `url(${src})`,
    maskSize: 'contain' as const,
    maskRepeat: 'no-repeat' as const,
    maskPosition: 'center' as const,
  };

  return (
    <>
      <span className={className} style={maskStyle} />
      <img src={src} alt="" width={0} height={0} className="hidden" onError={() => setFailed(true)} />
    </>
  );
}

function normalizeTimeString(timeStr: string): string {
  // Aladhan usually returns "HH:mm" but may include extra parts; we keep only the first token.
  return String(timeStr ?? '').trim().split(' ')[0];
}

function parseMinutes(timeStr: string): number {
  const normalized = normalizeTimeString(timeStr);
  const [hRaw, mRaw] = normalized.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function format12hFrom24(timeStr: string): string {
  const normalized = normalizeTimeString(timeStr);
  const [hRaw, mRaw] = normalized.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;
  const ampm = h >= 12 ? 'م' : 'ص';
  const ht = h % 12 || 12;
  return `${ht}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatLocalDateForAladhan(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function fetchPrayerTimes(coords: Coords): Promise<Record<PrayerId, string>> {
  const dateStr = formatLocalDateForAladhan(new Date());
  const url = `https://api.aladhan.com/v1/timings/${encodeURIComponent(dateStr)}?latitude=${encodeURIComponent(coords.lat)}&longitude=${encodeURIComponent(
    coords.lng
  )}&method=${ALADHAN_METHOD}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch prayer times: ${res.status}`);

  const data = await res.json();
  const timings = data?.data?.timings;
  if (!timings) throw new Error('Invalid Aladhan response');

  return {
    Fajr: timings.Fajr,
    Dhuhr: timings.Dhuhr,
    Asr: timings.Asr,
    Maghrib: timings.Maghrib,
    Isha: timings.Isha,
  } as Record<PrayerId, string>;
}

async function fetchCityNameAr(lat: number, lng: number, fallback: string = ''): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RMDATA_System/1.0' } });
    if (!res.ok) return fallback;
    const data = await res.json();
    let city = data?.address?.city || data?.address?.town || data?.address?.state || fallback;
    if (city.startsWith('إمارة ')) city = city.replace('إمارة ', '');
    return city;
  } catch {
    return fallback;
  }
}

function buildPrayerList(timeMap: Record<PrayerId, string>): Prayer[] {
  const defs: Array<{ id: PrayerId; nameAr: string; short: string }> = [
    { id: 'Fajr', nameAr: 'الفجر', short: 'FJR' },
    { id: 'Dhuhr', nameAr: 'الظهر', short: 'DHR' },
    { id: 'Asr', nameAr: 'العصر', short: 'ASR' },
    { id: 'Maghrib', nameAr: 'المغرب', short: 'MGR' },
    { id: 'Isha', nameAr: 'العشاء', short: 'ISH' },
  ];

  return defs.map((d) => {
    const time24 = normalizeTimeString(timeMap[d.id] ?? '');
    const minutes = parseMinutes(time24);
    return {
      id: d.id,
      nameAr: d.nameAr,
      short: d.short,
      time24,
      minutes,
      time12: format12hFrom24(time24),
    };
  });
}

function getNextPrayer(prayers: Prayer[]) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...prayers].sort((a, b) => a.minutes - b.minutes);
  const nextToday = sorted.find((p) => p.minutes > currentMinutes) ?? null;

  if (nextToday) {
    const nextDate = new Date(now);
    const h = Math.floor(nextToday.minutes / 60);
    const m = nextToday.minutes % 60;
    nextDate.setHours(h, m, 0, 0);
    return { next: nextToday, nextDate };
  }

  // After last prayer today -> Fajr next day
  const fajr = sorted.find((p) => p.id === 'Fajr') ?? sorted[0];
  const nextDate = new Date(now);
  const h = Math.floor(fajr.minutes / 60);
  const m = fajr.minutes % 60;
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(h, m, 0, 0);
  return { next: fajr, nextDate };
}

function formatLeftUntil(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours <= 0) return `${minutes} دقيقة`;
  return `${hours} ساعات و ${minutes} دقائق`;
}

export default function PrayerTimesWidget({
  className = '',
}: {
  className?: string;
}) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ok' | 'fallback' | 'error'>('loading');
  const [prayers, setPrayers] = useState<Prayer[] | null>(null);

  const [tick, setTick] = useState<number>(() => Date.now());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Update countdown every second.
    intervalRef.current = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveCoords = async () => {
      setLocationStatus('loading');

      // 1. Windows IPC or browser geolocation (macOS)
      try {
        const deviceCoords = await resolveDeviceCoordinates();
        if (!cancelled && deviceCoords) {
          console.log('DEVICE_LOCATION_SUCCESS:', deviceCoords.lat, deviceCoords.lng);
          let cityAr = await fetchCityNameAr(deviceCoords.lat, deviceCoords.lng);
          if (!cityAr) cityAr = getClosestEmirate(deviceCoords.lat, deviceCoords.lng);
          saveLastKnownLocation(deviceCoords.lat, deviceCoords.lng, cityAr);
          if (cancelled) return;
          setCoords({ lat: deviceCoords.lat, lng: deviceCoords.lng, city: cityAr });
          setLocationStatus('ok');
          return;
        }
        if (!cancelled) console.warn('DEVICE_LOCATION_FAILED: no coordinates');
      } catch (err) {
        if (!cancelled) console.warn('DEVICE_LOCATION_FAILED (exception):', err);
      }

      // 2. Fallback: last known location
      if (cancelled) return;
      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
        console.log('USING_LAST_KNOWN_LOCATION:', lastKnown.lat, lastKnown.lng);
        setCoords({ lat: lastKnown.lat, lng: lastKnown.lng, city: lastKnown.city });
        setLocationStatus('ok');
        return;
      }

      // 3. No location available at all
      if (cancelled) return;
      console.warn('DEVICE_LOCATION_FAILED: no fallback available');
      setLocationStatus('error');
    };

    resolveCoords().catch(() => {
      if (cancelled) return;
      setLocationStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!coords) return;
      try {
        setLocationStatus((s) => (s === 'loading' ? 'loading' : s));
        const timeMap = await fetchPrayerTimes(coords);
        if (cancelled) return;
        setPrayers(buildPrayerList(timeMap));
      } catch {
        if (cancelled) return;
        setLocationStatus('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const { nextPrayer, leftUntil } = useMemo(() => {
    if (!prayers || prayers.length < 5) return { nextPrayer: null as Prayer | null, leftUntil: '' };
    const { next, nextDate } = getNextPrayer(prayers);
    const diff = nextDate.getTime() - tick;
    return {
      nextPrayer: next,
      leftUntil: formatLeftUntil(diff),
    };
  }, [prayers, tick]);

  // Notify parent components about the current next prayer
  // (used by Dashboard header "welcome + du'a" block).
  useEffect(() => {
    if (!nextPrayer) return;
    window.dispatchEvent(
      new CustomEvent('prayer-times-updated', {
        detail: { prayerId: nextPrayer.id, prayerNameAr: nextPrayer.nameAr },
      })
    );
  }, [nextPrayer?.id, nextPrayer?.nameAr]);

  if (!prayers || prayers.length < 5 || !nextPrayer) {
    return (
      <div className={`w-full h-full flex flex-col ${className}`}>
        <div className="bg-secondary-gray/15 backdrop-blur rounded-2xl border border-secondary-gray/30 p-4 flex-1 min-h-full">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-dark-charcoal/70" />
            <div className="text-dark-charcoal/70 text-sm">
              {locationStatus === 'error'
                ? 'تعذر تحديد الموقع — يرجى تفعيل خدمة الموقع في إعدادات Windows'
                : `${t('nav.nextPrayer')} ...`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const locationHint =
    locationStatus === 'error'
      ? 'تعذر تحديد الموقع — يرجى تفعيل خدمة الموقع في Windows'
      : locationStatus === 'ok'
      ? coords?.city
        ? `الموقع الجغرافي: ${coords.city}`
        : 'الموقع مأخوذ من خدمة Windows'
      : 'جاري تحديد الموقع...';

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      <div className="bg-secondary-gray/15 backdrop-blur rounded-2xl border border-secondary-gray/30 p-4 flex-1 min-h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-secondary-gray/15 flex items-center justify-center">
              <MaskedIcon src={MOSQUE_ICON_SRC} size={22} className="text-primary-gold" />
            </div>
            <div className="text-dark-charcoal/90">
              <div className="text-xs opacity-70">باقي على</div>
              <div className="text-sm font-bold text-primary-gold">{nextPrayer.nameAr}</div>
              <div className="text-[11px] text-dark-charcoal/60">{leftUntil}</div>
            </div>
          </div>

          <div className="hidden sm:block text-[11px] text-dark-charcoal/50 pt-1 text-left">
            <div className="text-xs font-medium text-dark-charcoal max-w-[120px] truncate" title={locationHint}>
              {locationStatus === 'ok' && coords?.city ? coords.city : locationStatus === 'error' ? 'غير متوفر' : 'جاري التحديد...'}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2 flex-1 content-start">
          {prayers
            .slice()
            .sort((a, b) => a.minutes - b.minutes)
            .map((p) => {
              const isNext = p.id === nextPrayer.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border px-2 py-3 text-center ${
                    isNext
                      ? 'bg-primary-gold text-white border-primary-gold/50 shadow-[0_0_18px_rgba(163,122,63,0.35)]'
                      : 'bg-secondary-gray/10 text-dark-charcoal/80 border-secondary-gray/20'
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-bold">{p.nameAr}</div>
                  <div className="mt-1 text-xs sm:text-sm font-semibold">{p.time12}</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

