import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bus, Truck, Car, ChevronLeft, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePermissions } from '../../hooks/usePermissions';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';
import AddVehicleModal from './AddVehicleModal';
import { VEHICLE_TYPES, AR_BRAND_TO_KEY, VEHICLE_BRAND_KEYS, type VehicleTypeValue } from '../../constants/vehicles';
import { EntityAvatar } from '../shared/EntityAvatar';
import { dbQuery } from '../../services/dbClient';

const VEHICLE_TYPE_ICONS: Record<VehicleTypeValue, typeof Bus> = {
  bus: Bus,
  pickup: Truck,
  suv: Car,
  sedan: Car,
};

interface VehicleRow {
  id: number;
  code?: string;
  plateNumber: string;
  plateCode?: string;
  issuePlace?: string;
  brand?: string;
  model?: string;
  ownerName?: string;
  vehicleType?: string;
  photoPath?: string;
  licenseExpiryDate?: string;
  insuranceExpiryDate?: string;
  permitsAlerts?: { label: string; date: string }[];
}

function formatPlateDisplay(issuePlace?: string | null, plateCode?: string | null, plateNumber?: string): string {
  const num = (plateNumber || '').trim();
  const code = (plateCode || '').trim();
  const place = (issuePlace || '').trim();
  const codeNum = code ? `${code}-${num}` : num;
  if (!codeNum) return '—';
  return place ? `${place} ${codeNum}` : codeNum;
}

const VehicleThumbnail = memo(function VehicleThumbnail({
  photoPath,
  plateNumber: _plateNumber,
  vehicleType,
}: {
  photoPath?: string;
  plateNumber: string;
  vehicleType?: string;
}) {
  const typeIcon = vehicleType && VEHICLE_TYPES.some((x) => x.value === vehicleType)
    ? VEHICLE_TYPE_ICONS[vehicleType as VehicleTypeValue]
    : Car;
  const Icon = typeIcon;
  return (
    <EntityAvatar
      imagePath={photoPath}
      className="w-12 h-12 rounded-lg object-cover shrink-0"
      alt=""
      fallback={
        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-light-background">
          <Icon size={24} className="text-primary-gold" />
        </div>
      }
    />
  );
});

function getDaysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type VehicleExpiryItem = { label: string; date: string; daysUntil: number; status: 'ok' | 'warning' | 'expired' };

const EMPTY_VEHICLE_EXPIRIES: VehicleExpiryItem[] = [];

function getVehicleExpiries(
  v: VehicleRow,
  t: (key: string) => string,
  warningDays: number
): VehicleExpiryItem[] {
  const items: { label: string; date: string }[] = [];
  if (v.licenseExpiryDate) items.push({ label: t('vehicles.license'), date: v.licenseExpiryDate });
  if (v.insuranceExpiryDate) items.push({ label: t('vehicles.insurance'), date: v.insuranceExpiryDate });
  if (Array.isArray(v.permitsAlerts) && v.permitsAlerts.length > 0) {
    for (const alert of v.permitsAlerts) {
      if (alert?.date) {
        items.push({ label: alert.label || t('vehicles.permitsTitle'), date: alert.date });
      }
    }
  }
  return items
    .map((i) => {
      const daysUntil = getDaysUntil(i.date)!;
      const status: VehicleExpiryItem['status'] = daysUntil <= 1 ? 'expired' : daysUntil <= warningDays ? 'warning' : 'ok';
      return { label: i.label, date: i.date, daysUntil, status };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getTypeLabel(value: string | undefined, t: (key: string) => string): string {
  if (!value) return '—';
  const key = `vehicles.types.${value}`;
  const translated = t(key);
  return translated !== key ? translated : value;
}

function getBrandLabel(value: string | undefined, t: (key: string) => string): string {
  if (!value) return '—';
  const key = AR_BRAND_TO_KEY[value] ?? (VEHICLE_BRAND_KEYS.includes(value as any) ? value : null);
  if (!key) return value;
  const translated = t(`vehicles.brands.${key}`);
  return translated !== `vehicles.brands.${key}` ? translated : value;
}

const VehicleGridCard = memo(function VehicleGridCard({
  v,
  onOpen,
  visibleExpiries,
  t,
}: {
  v: VehicleRow;
  onOpen: (id: number) => void;
  visibleExpiries: VehicleExpiryItem[];
  t: TFunction;
}) {
  const typeIcon = v.vehicleType && VEHICLE_TYPES.some((x) => x.value === v.vehicleType)
    ? VEHICLE_TYPE_ICONS[v.vehicleType as VehicleTypeValue]
    : Car;
  const TypeIcon = typeIcon;
  const brandModel = [getBrandLabel(v.brand, t), v.model].filter(Boolean).join(' / ') || '—';
  return (
    <div
      onClick={() => onOpen(v.id)}
      className="relative bg-white p-3 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col"
    >
      <div className="flex items-center gap-3 mb-2">
        <VehicleThumbnail photoPath={v.photoPath} plateNumber={v.plateNumber} vehicleType={v.vehicleType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeIcon size={20} className="shrink-0 text-primary-gold" />
            <h3 className="font-bold text-primary-gold text-lg">{formatPlateDisplay(v.issuePlace, v.plateCode, v.plateNumber)}</h3>
            {v.code && <span className="text-xs text-dark-charcoal/70 font-mono">{v.code}</span>}
          </div>
          <p className="text-sm text-dark-charcoal/70 truncate">{brandModel}</p>
          {v.ownerName && (
            <p className="text-sm text-dark-charcoal/80 mt-0.5 truncate">
              {t('vehicles.owner')}: {v.ownerName}
            </p>
          )}
        </div>
      </div>
      {visibleExpiries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-secondary-gray/50 flex flex-col gap-1.5">
          {visibleExpiries.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-center gap-2 text-xs ${
                item.status === 'expired' ? 'text-alert-red' : item.status === 'warning' ? 'text-yellow-700' : 'text-success-green'
              }`}
            >
              {item.status === 'ok' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
              {item.status === 'warning' && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
              {item.status === 'expired' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
              <span>
                {item.daysUntil < 0
                  ? `${item.label}: ${t('vehicles.expiredDays', { count: Math.abs(item.daysUntil) })}`
                  : item.daysUntil === 0
                    ? `${item.label}: ${t('vehicles.expiresToday')}`
                    : `${item.label}: ${t('vehicles.expiresInDays', { count: item.daysUntil })}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const VehicleTableRow = memo(function VehicleTableRow({
  v,
  onOpen,
  visibleExpiries,
  t,
}: {
  v: VehicleRow;
  onOpen: (id: number) => void;
  visibleExpiries: VehicleExpiryItem[];
  t: TFunction;
}) {
  const typeIcon = v.vehicleType && VEHICLE_TYPES.some((x) => x.value === v.vehicleType)
    ? VEHICLE_TYPE_ICONS[v.vehicleType as VehicleTypeValue]
    : Car;
  const TypeIcon = typeIcon;
  const brandModel = [getBrandLabel(v.brand, t), v.model].filter(Boolean).join(' / ') || '—';
  return (
    <tr
      className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
      onClick={() => onOpen(v.id)}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <VehicleThumbnail photoPath={v.photoPath} plateNumber={v.plateNumber} vehicleType={v.vehicleType} />
          <div className="flex items-center gap-2">
            <TypeIcon size={20} className="shrink-0 text-primary-gold" />
            <span className="font-medium text-dark-charcoal">{formatPlateDisplay(v.issuePlace, v.plateCode, v.plateNumber)}</span>
            {v.code && <span className="text-xs text-dark-charcoal/70 font-mono">{v.code}</span>}
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-dark-charcoal">{getTypeLabel(v.vehicleType, t)}</td>
      <td className="py-4 px-4 text-dark-charcoal">{brandModel}</td>
      <td className="py-4 px-4 text-dark-charcoal">{v.ownerName || '—'}</td>
      <td className="py-4 px-4">
        {visibleExpiries.length > 0 ? (
          <div className="flex flex-col gap-1">
            {visibleExpiries.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-xs ${
                  item.status === 'expired' ? 'text-alert-red' : item.status === 'warning' ? 'text-yellow-700' : 'text-success-green'
                }`}
              >
                {item.status === 'ok' && <CheckCircle size={14} className="shrink-0" />}
                {item.status === 'warning' && <AlertTriangle size={14} className="shrink-0" />}
                {item.status === 'expired' && <AlertCircle size={14} className="shrink-0" />}
                <span>
                  {item.daysUntil < 0
                    ? `${item.label}: ${t('vehicles.expiredDays', { count: Math.abs(item.daysUntil) })}`
                    : item.daysUntil === 0
                      ? `${item.label}: ${t('vehicles.expiresToday')}`
                      : `${item.label}: ${t('vehicles.expiresInDays', { count: item.daysUntil })}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-secondary-gray text-sm">—</span>
        )}
      </td>
      <td className="py-4 px-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(v.id);
          }}
          className="p-2 hover:bg-secondary-gray/30 rounded-lg"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      </td>
    </tr>
  );
});

export default function Vehicles() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { can } = usePermissions();
  const { expiryWarningDays, showGreenExpiry, showYellowExpiry } = useExpiryUiSettings();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode('vehicles_viewMode', 'grid');

  const loadVehicles = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!window.electronAPI?.dbQuery) {
        setVehicles([]);
        return;
      }
      const [vehiclesRes, permitsRes] = await Promise.all([
        dbQuery<VehicleRow[]>(
        `SELECT id, code, plateNumber, plateCode, issuePlace, brand, model, ownerName, vehicleType, photoPath,
                  licenseExpiryDate, insuranceExpiryDate
           FROM vehicles
           WHERE status != 'archived'
           ORDER BY id DESC`,
          undefined,
          { signal }
        ),
        dbQuery<{ vehicleId: number; title?: string; alertDate: string }[]>(
          `SELECT vehicleId, title, alertDate
           FROM vehicle_custom_fields
           WHERE enableAlert = 1
             AND alertDate IS NOT NULL
             AND alertDate != ''`,
          undefined,
          { signal }
        ),
      ]);
      if (signal?.aborted) return;
      const permitsByVehicle = new Map<number, { label: string; date: string }[]>();
      for (const row of permitsRes?.data ?? []) {
        const vehicleId = Number(row.vehicleId);
        if (!Number.isFinite(vehicleId)) continue;
        const list = permitsByVehicle.get(vehicleId) || [];
        list.push({
          label: String(row.title || t('vehicles.permitsTitle')),
          date: String(row.alertDate),
        });
        permitsByVehicle.set(vehicleId, list);
      }
      const merged = (vehiclesRes?.data ?? []).map((v) => ({
        ...v,
        permitsAlerts: permitsByVehicle.get(v.id) || [],
      }));
      setVehicles(merged);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setVehicles([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadVehicles(ac.signal);
    return () => ac.abort();
  }, [loadVehicles]);

  const openVehicle = useCallback(
    (id: number) => {
      navigate(`/dashboard/vehicles/${id}`);
    },
    [navigate]
  );

  const visibleExpiriesByVehicleId = useMemo(() => {
    const m = new Map<number, VehicleExpiryItem[]>();
    for (const v of vehicles) {
      const expiries = getVehicleExpiries(v, t, expiryWarningDays);
      const visible = expiries.filter((item) => {
        if (item.status === 'expired') return true;
        if (item.status === 'ok') return showGreenExpiry;
        return showYellowExpiry;
      });
      m.set(v.id, visible);
    }
    return m;
  }, [vehicles, t, expiryWarningDays, showGreenExpiry, showYellowExpiry]);

  if (!can('vehicles', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('vehicles.title')}</h1>
        <div className="flex items-center gap-3">
          {!isMobile && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
          {can('vehicles', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors min-h-[44px]"
            >
              {t('vehicles.addVehicle')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p className="text-secondary-gray">{t('vehicles.loading')}</p>
        ) : vehicles.length === 0 ? (
          <p className="text-secondary-gray">{t('vehicles.noVehicles')}</p>
        ) : viewMode === 'grid' || isMobile ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {vehicles.map((v) => (
              <VehicleGridCard
                key={v.id}
                v={v}
                onOpen={openVehicle}
                visibleExpiries={visibleExpiriesByVehicleId.get(v.id) ?? EMPTY_VEHICLE_EXPIRIES}
                t={t}
              />
            ))}
          </div>
        ) : !isMobile ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-light-background">
                <tr>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('vehicles.tablePlate')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('vehicles.tableType')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('vehicles.tableBrandModel')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('vehicles.tableOwner')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('vehicles.tableExpiryAlerts')}</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <VehicleTableRow
                    key={v.id}
                    v={v}
                    onOpen={openVehicle}
                    visibleExpiries={visibleExpiriesByVehicleId.get(v.id) ?? EMPTY_VEHICLE_EXPIRIES}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <AddVehicleModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => void loadVehicles()}
      />
    </div>
  );
}
