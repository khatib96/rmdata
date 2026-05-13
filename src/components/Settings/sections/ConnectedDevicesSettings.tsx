import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, MonitorSmartphone, MapPin, Trash2, Clock, Filter, Eraser } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';

interface ConnectedDevice {
  id: number;
  userId: number;
  username: string;
  deviceName: string | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
  ipAddress: string | null;
  publicIp?: string | null;
  locationCity: string | null;
  gpsCoordinates: string | null;
  appVersion: string | null;
  lastActive: string | null;
  token: string;
  /** 1/0 من الخادم — مقارنة lastActive مع datetime('now') على نفس قاعدة البيانات */
  isOnlineServer?: number | boolean | string | null;
}

/** هامش «آخر نشاط» بالدقائق — يُبقى متزامناً مع عبارة SQL أدناه (-5 minutes) */
const ONLINE_WINDOW_MINS = 5;
const LOCAL_PING_OK_MS = ONLINE_WINDOW_MINS * 60_000;
const badLastActiveWarned = new Set<string>();

/**
 * تحويل lastActive إلى طابع زمني للعرض والاحتياطي فقط.
 * يدعم ISO مع إزاحة (مفضّل من الخادم) وصيغة SQLite النصية الشائعة.
 */
function parseLastActiveToMs(s: string | null): number | null {
  if (!s || !String(s).trim()) return null;
  const raw = String(s).trim();
  let ms: number;
  if (/T\d/.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw) || /Z$/i.test(raw)) {
    ms = new Date(raw).getTime();
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
    ms = new Date(`${raw.replace(' ', 'T')}Z`).getTime();
  } else {
    ms = new Date(raw).getTime();
  }
  if (!Number.isFinite(ms)) {
    if (!badLastActiveWarned.has(raw)) {
      badLastActiveWarned.add(raw);
      console.warn('connected_devices: invalid lastActive format:', raw);
    }
    return null;
  }
  return ms;
}

function isOnlineByServerTime(lastActiveStr: string | null): boolean {
  const ms = parseLastActiveToMs(lastActiveStr);
  if (ms == null) return false;
  const diffMins = (Date.now() - ms) / 60000;
  return diffMins <= ONLINE_WINDOW_MINS;
}

function readServerOnlineFlag(device: ConnectedDevice): boolean | null {
  const row = device as ConnectedDevice & Record<string, unknown>;
  const v =
    device.isOnlineServer ??
    row.isonlineserver ??
    row.ISONLINESERVER;
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true') return true;
  if (s === '0' || s === 'false' || s === '') return false;
  const n = Number(v);
  if (Number.isFinite(n)) return n === 1;
  return null;
}

function formatLastActiveForDisplay(lastActiveStr: string | null): string {
  const ms = parseLastActiveToMs(lastActiveStr);
  if (ms == null) return lastActiveStr ? String(lastActiveStr) : '-';
  return new Date(ms).toLocaleString('ar-AE');
}

function isDeviceOnline(
  device: ConnectedDevice,
  currentSessionToken: string | null,
  lastDevicePingOkAt: number | null,
): boolean {
  if (
    device.token === currentSessionToken &&
    lastDevicePingOkAt != null &&
    Date.now() - lastDevicePingOkAt <= LOCAL_PING_OK_MS
  ) {
    return true;
  }
  const serverFlag = readServerOnlineFlag(device);
  if (serverFlag === true) return true;
  if (serverFlag === false) return false;
  return isOnlineByServerTime(device.lastActive);
}

export default function ConnectedDevicesSettings() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  const currentSessionToken = useAuthStore((s) => s.sessionToken);
  const lastDevicePingOkAt = useAuthStore((s) => s.lastDevicePingOkAt);

  const load = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.dbQuery(
        `SELECT id, userId, username, deviceName, deviceId, deviceLabel, ipAddress, publicIp, locationCity, gpsCoordinates, appVersion, lastActive, token,
          CASE
            WHEN lastActive IS NOT NULL AND datetime(lastActive) >= datetime('now', '-${ONLINE_WINDOW_MINS} minutes') THEN 1
            ELSE 0
          END AS isOnlineServer
         FROM connected_devices
         ORDER BY lastActive DESC`
      );
      if (res && res.success === false && res.error) {
        toast.error(res.error || 'تعذر تحميل الأجهزة المتصلة');
        setDevices([]);
        return;
      }
      setDevices((res?.data ?? []) as ConnectedDevice[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 12_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const sortedDevices = useMemo(() => {
    const list = activeOnly
      ? devices.filter(
          (d) => isDeviceOnline(d, currentSessionToken, lastDevicePingOkAt) || d.token === currentSessionToken,
        )
      : devices;

    return [...list].sort((a, b) => {
      const aCurrent = a.token === currentSessionToken ? 0 : 1;
      const bCurrent = b.token === currentSessionToken ? 0 : 1;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;

      const aOnline = isDeviceOnline(a, currentSessionToken, lastDevicePingOkAt) ? 0 : 1;
      const bOnline = isDeviceOnline(b, currentSessionToken, lastDevicePingOkAt) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;

      const aTime = parseLastActiveToMs(a.lastActive) ?? 0;
      const bTime = parseLastActiveToMs(b.lastActive) ?? 0;
      return bTime - aTime;
    });
  }, [devices, currentSessionToken, activeOnly, lastDevicePingOkAt]);

  const forceLogout = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج الإجباري لهذا الجهاز؟')) return;
    try {
      const r = await window.electronAPI?.dbQuery?.('DELETE FROM connected_devices WHERE id = ?', [id]);
      if (r && r.success === false) {
        toast.error(r.error || 'فشل تسجيل الخروج (تحقق من اتصال الـ API)');
        return;
      }
      toast.success('تم تسجيل الخروج للجهاز بنجاح.');
      load();
    } catch {
      toast.error('حدث خطأ أثناء محاولة تسجيل الخروج.');
    }
  };

  const cleanupStaleSessions = async () => {
    if (!window.confirm('سيتم حذف جميع الجلسات غير النشطة (أقدم من ساعتين). هل تريد المتابعة؟')) return;
    try {
      const r = await window.electronAPI?.dbQuery?.(
        `DELETE FROM connected_devices WHERE lastActive < datetime('now', '-2 hours') AND token != ?`,
        [currentSessionToken || '']
      );
      if (r && r.success === false) {
        toast.error(r.error || 'فشل تنظيف الجلسات');
        return;
      }
      toast.success('تم تنظيف الجلسات القديمة بنجاح.');
      load();
    } catch {
      toast.error('حدث خطأ أثناء تنظيف الجلسات.');
    }
  };

  const getStatusLabel = (device: ConnectedDevice) =>
    isDeviceOnline(device, currentSessionToken, lastDevicePingOkAt) ? 'متصل حالياً' : 'غير متصل';

  const staleCount = devices.filter(
    (d) => !isDeviceOnline(d, currentSessionToken, lastDevicePingOkAt) && d.token !== currentSessionToken,
  ).length;

  if (loading && devices.length === 0) {
    return <p className="text-secondary-gray">{t('settings.loading', 'جاري التحميل...')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-secondary-gray pb-4">
        <Shield size={24} className="text-primary-gold" />
        <h2 className="text-xl font-bold text-dark-charcoal">
          {t('settings.connectedDevices', 'إدارة الأجهزة المتصلة')}
        </h2>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
        <MonitorSmartphone size={24} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-800">تتبع الأجهزة وتسجيل الخروج عن بُعد</h4>
          <p className="text-amber-700 text-sm mt-1 leading-relaxed">
            تعرض هذه القائمة جميع الأجهزة التي سجلت الدخول حالياً إلى النظام. يمكنك مراجعة موقع الجهاز، هويته، وحالة اتصاله، وإجباره على تسجيل الخروج لأسباب أمنية.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveOnly((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            activeOnly
              ? 'bg-primary-gold text-white border-primary-gold'
              : 'bg-white text-dark-charcoal border-secondary-gray hover:bg-secondary-gray/20'
          }`}
        >
          <Filter size={16} />
          النشطة فقط
        </button>

        {staleCount > 0 && (
          <button
            type="button"
            onClick={cleanupStaleSessions}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-alert-red border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Eraser size={16} />
            تنظيف الجلسات القديمة ({staleCount})
          </button>
        )}

        <span className="text-xs text-secondary-gray mr-auto">
          {devices.length} جلسة مسجلة
          {activeOnly ? ` · ${sortedDevices.length} نشطة` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedDevices.map((device) => {
          const isCurrentSession = device.token === currentSessionToken;
          const status = getStatusLabel(device);
          const isOnline = status === 'متصل حالياً';
          const serverFlag = readServerOnlineFlag(device);
          const statusTitle =
            serverFlag !== null
              ? 'الحالة تُحسب وفق وقت الخادم وآخر نشاط مسجّل (لا تعتمد على ساعة هذا الجهاز).'
              : 'لم يُرجع الخادم حقل الحالة؛ العرض احتياطي من هذا الجهاز.';

          return (
            <div
              key={device.id}
              className={`border rounded-lg p-5 flex flex-col gap-3 transition-colors ${
                isCurrentSession
                  ? 'border-primary-gold bg-primary-gold/5'
                  : 'border-secondary-gray bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-dark-charcoal text-lg">{device.username}</span>
                  <span
                    className="text-sm text-secondary-gray mt-1 min-h-[1.25rem] truncate"
                    title={device.deviceLabel || device.deviceName || 'غير معروف'}
                  >
                    {device.deviceLabel || device.deviceName || 'جهاز غير معروف'}
                  </span>
                </div>
                {isCurrentSession && (
                  <span className="text-xs font-semibold bg-primary-gold text-white px-2 py-1 rounded">
                    الجلسة الحالية
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm text-dark-charcoal">
                  <MonitorSmartphone size={16} className="text-secondary-gray" />
                  <span dir="ltr">
                    {device.ipAddress || 'N/A'}
                    {device.publicIp ? ` · ${device.publicIp}` : ''}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-dark-charcoal" title={device.gpsCoordinates || ''}>
                  <MapPin size={16} className="text-secondary-gray" />
                  <span className="line-clamp-1">
                    {device.locationCity || (device.gpsCoordinates ? 'تم تحديد الموقع' : 'غير متوفر')}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 text-sm text-dark-charcoal"
                  title={statusTitle}
                >
                  <Clock size={16} className="text-secondary-gray" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-success-green animate-pulse' : 'bg-secondary-gray'}`} />
                    <span>{status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-secondary-gray mt-2 pt-2 border-t border-secondary-gray/30">
                  <span dir="ltr">V: {device.appVersion || 'Unknown'}</span>
                  <span>&bull;</span>
                  <span>آخر نشاط: {formatLastActiveForDisplay(device.lastActive)}</span>
                </div>
              </div>

              {!isCurrentSession && (
                <button
                  type="button"
                  onClick={() => forceLogout(device.id)}
                  className="mt-3 flex justify-center items-center gap-2 w-full py-2 bg-red-50 hover:bg-red-100 text-alert-red font-medium rounded-lg transition-colors border border-red-200"
                >
                  <Trash2 size={18} />
                  تسجيل الخروج الإجباري
                </button>
              )}
            </div>
          );
        })}

        {sortedDevices.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-secondary-gray">
            {activeOnly ? 'لا توجد جلسات نشطة حالياً.' : 'لا توجد جلسات مسجلة.'}
          </div>
        )}
      </div>
    </div>
  );
}
