import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Car,
  FileText,
  FolderOpen,
  History,
  UserPlus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Bus,
  Truck,
  Pencil,
  Archive,
  Trash2,
  Eye,
  Download,
  Image as ImageIcon,
  File,
} from 'lucide-react';
import { VEHICLE_TYPES, AR_BRAND_TO_KEY, VEHICLE_BRAND_KEYS, type VehicleTypeValue } from '../../constants/vehicles';
import UpdateExpiryPopup, { type UpdateExpiryConfig, type DocumentLinkConfig } from '../shared/UpdateExpiryPopup';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import HistoryTab from '../shared/HistoryTab';
import AssignResponsibleModal from './AssignResponsibleModal';
import AddVehicleModal from './AddVehicleModal';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';
import DocumentPreviewModal from '../shared/DocumentPreviewModal';
import type { DocumentPreview, DocumentListItem } from '../../types/documents';
import { getDocumentDisplayName } from '../../utils/documentHelpers';

const VEHICLE_TYPE_ICONS: Record<VehicleTypeValue, typeof Car> = {
  bus: Bus,
  pickup: Truck,
  suv: Car,
  sedan: Car,
};

const TAB_IDS = ['basic', 'licenses', 'permits', 'history', 'documents'] as const;
function getTabs(t: (k: string) => string) {
  return [
    { id: 'basic' as const, label: t('vehicles.tabBasic'), icon: Car },
    { id: 'licenses' as const, label: t('vehicles.tabLicenses'), icon: FileText },
    { id: 'permits' as const, label: t('vehicles.tabPermits'), icon: FileText },
    { id: 'history' as const, label: t('vehicles.tabHistory'), icon: History },
    { id: 'documents' as const, label: t('vehicles.tabDocuments'), icon: FolderOpen },
  ];
}

type TabId = (typeof TAB_IDS)[number];

interface VehicleDetails {
  id: number;
  code?: string;
  photoPath?: string;
  plateNumber: string;
  plateCode?: string;
  vehicleName?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: string;
  ownershipType?: string;
  ownerName?: string;
  issuePlace?: string;
  trafficNo?: string;
  chassisNo?: string;
  licenseRegDate?: string;
  licenseExpiryDate?: string;
  insuranceCompany?: string;
  insuranceExpiryDate?: string;
  insuranceType?: string;
  insurancePolicyNo?: string;
  branchId?: number;
  responsibleEmployeeId?: number | null;
  responsibleEmployerId?: number | null;
  responsibleName?: string | null;
  status?: string;
}

interface CustomFieldRow {
  id: number;
  title: string;
  content?: string;
  enableAlert?: boolean;
  alertDate?: string;
  daysBeforeExpiry?: number;
}

function getTypeLabel(value: string | undefined, t: (k: string) => string): string {
  if (!value) return '—';
  const key = `vehicles.types.${value}`;
  const translated = t(key);
  return translated !== key ? translated : value;
}

function getOwnershipLabel(value: string | undefined, t: (k: string) => string): string {
  if (!value) return '—';
  const key = `vehicles.ownership.${value}`;
  const translated = t(key);
  return translated !== key ? translated : value;
}

function getInsuranceLabel(value: string | undefined, t: (k: string) => string): string {
  if (!value) return '—';
  const key = `vehicles.insuranceTypes.${value}`;
  const translated = t(key);
  return translated !== key ? translated : value;
}

function getBrandLabel(value: string | undefined, t: (k: string) => string): string {
  if (!value) return '—';
  const key = AR_BRAND_TO_KEY[value] ?? (VEHICLE_BRAND_KEYS.includes(value as any) ? value : null);
  if (!key) return value;
  const translated = t(`vehicles.brands.${key}`);
  return translated !== `vehicles.brands.${key}` ? translated : value;
}

function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isWithin30Days(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

/** تنسيق عرض اللوحة: الإمارة + الرمز-رقم (نفس الخط) مثل "دبي M-80097" */
function formatPlateDisplay(issuePlace?: string | null, plateCode?: string | null, plateNumber?: string): string {
  const num = (plateNumber || '').trim();
  const code = (plateCode || '').trim();
  const place = (issuePlace || '').trim();
  const codeNum = code ? `${code}-${num}` : num;
  if (!codeNum) return '—';
  return place ? `${place} ${codeNum}` : codeNum;
}

export default function VehicleProfile() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = useMemo(() => can('vehicles', 'edit'), [can]);
  const canDelete = useMemo(() => can('vehicles', 'delete'), [can]);
  const canArchive = canEdit;
  const ALL_TABS = getTabs(t);
  const TABS = useMemo(() => ALL_TABS.filter((tab) => can('vehicles', `tab.${tab.id}`)), [can]);
  const vehicleId = parseInt(id ?? '', 10);
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [expiryPopup, setExpiryPopup] = useState<{
    config: UpdateExpiryConfig;
    documentConfig?: DocumentLinkConfig;
    currentExpiry?: string;
    title: string;
  } | null>(null);
  const [assignResponsibleOpen, setAssignResponsibleOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [docPreview, setDocPreview] = useState<DocumentPreview | null>(null);

  const loadVehicle = async () => {
    if (!window.electronAPI?.dbQuery || isNaN(vehicleId)) return;
    setLoading(true);
    try {
      const [vRes, cfRes, docRes] = await Promise.all([
        window.electronAPI.dbQuery('SELECT * FROM vehicles WHERE id = ?', [vehicleId]),
        window.electronAPI.dbQuery('SELECT * FROM vehicle_custom_fields WHERE vehicleId = ?', [vehicleId]),
        window.electronAPI.documentList?.('vehicle', vehicleId),
      ]);
      const v = vRes?.data?.[0];
      if (!v) {
        setVehicle(null);
        setLoading(false);
        return;
      }
      setVehicle(v as VehicleDetails);
      setCustomFields((cfRes?.data ?? []) as CustomFieldRow[]);
      setDocuments(docRes?.success && Array.isArray(docRes.data) ? docRes.data : []);

      if (v.branchId) {
        const bRes = await window.electronAPI.dbQuery('SELECT name FROM branches WHERE id = ?', [v.branchId]);
        setBranchName(bRes?.data?.[0]?.name ?? null);
      } else setBranchName(null);

      if (v.photoPath && window.electronAPI.fileGetImageUrl) {
        const img = await window.electronAPI.fileGetImageUrl(v.photoPath);
        setImageUrl(img?.success && img?.url ? img.url : null);
      } else setImageUrl(null);
    } catch (e) {
      console.error(e);
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const handleExpirySaved = () => {
    setExpiryPopup(null);
    loadVehicle();
  };

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const performerLabel = user ? `${user.fullName || user.username}${user.entityId != null ? ` (${user.entityId})` : ''}` : t('vehicles.system');

  const handleArchive = async () => {
    if (!window.electronAPI?.archiveRecord) return;
    try {
      const res = await window.electronAPI.archiveRecord(sessionToken, 'vehicles', vehicleId);
      if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      const label = vehicle?.plateNumber || vehicle?.code || `مركبة ${vehicleId}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'vehicle',
        entityId: vehicleId,
        details: `archived::vehicle::${label}::${performerLabel}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      setArchiveConfirm(false);
      navigate('/dashboard/vehicles');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.electronAPI?.archiveDeletePermanent) return;
    try {
      const res = await window.electronAPI.archiveDeletePermanent(sessionToken, 'vehicles', vehicleId);
      if (!res?.success) throw new Error(res?.error || 'DELETE_FAILED');
      setDeleteConfirm(false);
      navigate('/dashboard/vehicles');
    } catch (e) {
      console.error(e);
    }
  };


  if (isNaN(vehicleId)) {
    navigate('/dashboard/vehicles');
    return null;
  }

  if (loading) {
    return <div className="p-12 text-center text-secondary-gray">{t('vehicles.loading')}</div>;
  }

  if (!vehicle) {
    return (
      <div className="p-12 text-center">
        <p className="text-secondary-gray mb-4">{t('vehicles.vehicleNotFound')}</p>
        <button
          onClick={() => navigate('/dashboard/vehicles')}
          className="text-primary-gold hover:underline"
        >
          {t('vehicles.back')}
        </button>
      </div>
    );
  }

  const typeIcon = vehicle.vehicleType && VEHICLE_TYPES.some((t) => t.value === vehicle.vehicleType)
    ? VEHICLE_TYPE_ICONS[vehicle.vehicleType as VehicleTypeValue]
    : Car;
  const TypeIcon = typeIcon;
  const licenseExpired = isExpired(vehicle.licenseExpiryDate);
  const licenseWarning = isWithin30Days(vehicle.licenseExpiryDate);
  const insuranceExpired = isExpired(vehicle.insuranceExpiryDate);
  const insuranceWarning = isWithin30Days(vehicle.insuranceExpiryDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/dashboard/vehicles')}
          className="flex items-center gap-2 text-dark-charcoal hover:text-primary-gold"
        >
          <ArrowRight size={20} className="rotate-180" />
          {t('vehicles.back')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* الشريط العلوي: خلفية محايدة موحدة مع باقي الأقسام، رقم المعرف بخط صغير فوق الاسم داخل مربع رمادي */}
        <div className="relative flex flex-row items-center justify-between gap-6 p-6 bg-gray-50 border-b border-secondary-gray/30">
          <div className="shrink-0">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-md">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <TypeIcon size={48} className="text-primary-gold" />
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
            {vehicle.code && (
              <span className="inline-block px-2.5 py-1 rounded bg-gray-200 text-dark-charcoal/80 text-xs font-medium mb-2">
                {vehicle.code}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">
              {formatPlateDisplay(vehicle.issuePlace, vehicle.plateCode, vehicle.plateNumber)}
            </h1>
            {(vehicle.vehicleName || vehicle.brand || vehicle.model) && (
              <p className="text-dark-charcoal/80 mt-1">
                {vehicle.vehicleName || [getBrandLabel(vehicle.brand, t), vehicle.model].filter(Boolean).join(' / ') || '—'}
                {vehicle.year && !vehicle.vehicleName && ` — ${vehicle.year}`}
              </p>
            )}
            {vehicle.ownerName && (
              <p className="text-dark-charcoal/70 text-sm mt-0.5">{t('vehicles.owner')}: {vehicle.ownerName}</p>
            )}
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setAssignResponsibleOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-gold text-white rounded-lg hover:bg-primary-gold/90"
            >
              <UserPlus size={20} />
              {t('vehicles.assignResponsible')}
            </button>
          </div>
        </div>

        <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent" />

        {/* أزرار التعديل فوق التبويبات (مثل أصحاب العمل) — عربي: يسار، إنجليزي: يمين */}
        <div className="shrink-0 flex items-center justify-end gap-2 mb-4">
          {canEdit && <button
            onClick={() => setEditModalOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
          >
            <Pencil size={18} />
            {t('vehicles.edit')}
          </button>}
        </div>

        {/* التبويبات */}
        <TabsOrDropdown
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />

        <div className="p-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <h3 className="text-primary-gold font-bold">{t('vehicles.basicDataTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dl className="space-y-2 text-sm">
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.plateNumber')}</dt><dd className="font-medium text-xl font-bold text-primary-gold">{formatPlateDisplay(vehicle.issuePlace, vehicle.plateCode, vehicle.plateNumber)}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.vehicleName')}</dt><dd className="font-medium">{vehicle.vehicleName || '—'}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.brandModel')}</dt><dd className="font-medium">{[getBrandLabel(vehicle.brand, t), vehicle.model].filter(Boolean).join(' / ') || '—'}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.year')}</dt><dd className="font-medium">{vehicle.year ?? '—'}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.vehicleType')}</dt><dd className="font-medium">{getTypeLabel(vehicle.vehicleType, t)}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.ownershipType')}</dt><dd className="font-medium">{getOwnershipLabel(vehicle.ownershipType, t)}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.ownerName')}</dt><dd className="font-medium">{vehicle.ownerName || '—'}</dd></div>
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.issuePlace')}</dt><dd className="font-medium">{vehicle.issuePlace || '—'}</dd></div>
                    {branchName && <div><dt className="text-dark-charcoal/60">{t('vehicles.linkedBranch')}</dt><dd className="font-medium">{branchName}</dd></div>}
                  </dl>
                </div>
                <div>
                  <h3 className="text-primary-gold font-bold mb-3">{t('vehicles.trafficCode')}</h3>
                  <dl className="space-y-2 text-sm">
                    <div><dt className="text-dark-charcoal/60">{t('vehicles.trafficCode')}</dt><dd className="font-medium">{vehicle.trafficNo || '—'}</dd></div>
                  </dl>
                  {(vehicle.responsibleName || vehicle.responsibleEmployeeId || vehicle.responsibleEmployerId) && (
                    <>
                      <h3 className="text-primary-gold font-bold mt-4 mb-3">{t('vehicles.responsible')}</h3>
                      <p className="font-medium">{vehicle.responsibleName || '—'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="space-y-6">
              <div className="border border-secondary-gray/50 rounded-lg p-4">
                <h3 className="text-primary-gold font-bold mb-3">{t('vehicles.licenseTitle')}</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.regDate')}</dt><dd>{vehicle.licenseRegDate ? String(vehicle.licenseRegDate).slice(0, 10) : '—'}</dd></div>
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.expiryDate')}</dt><dd className="flex items-center gap-1">
                    {vehicle.licenseExpiryDate ? String(vehicle.licenseExpiryDate).slice(0, 10) : '—'}
                    {(licenseExpired || licenseWarning) && vehicle.licenseExpiryDate && (
                      <button
                        type="button"
                        onClick={() => setExpiryPopup({
                          config: { table: 'vehicles', column: 'licenseExpiryDate', recordId: vehicleId },
                          documentConfig: { entityType: 'vehicle', entityId: vehicleId, section: 'license' },
                          currentExpiry: String(vehicle.licenseExpiryDate).slice(0, 10),
                          title: t('vehicles.updateLicenseExpiry'),
                        })}
                        className="text-primary-gold hover:underline text-xs"
                      >
                        {t('vehicles.update')}
                      </button>
                    )}
                  </dd></div>
                </dl>
                {licenseExpired && <p className="text-alert-red text-sm flex items-center gap-1"><AlertTriangle size={16} /> {t('vehicles.expired')}</p>}
                {licenseWarning && !licenseExpired && <p className="text-yellow-700 text-sm flex items-center gap-1"><AlertTriangle size={16} /> {t('vehicles.expiringSoon')}</p>}
                {!licenseExpired && !licenseWarning && vehicle.licenseExpiryDate && <p className="text-success-green text-sm flex items-center gap-1"><CheckCircle size={16} /> {t('vehicles.valid')}</p>}
              </div>
              <div className="border border-secondary-gray/50 rounded-lg p-4">
                <h3 className="text-primary-gold font-bold mb-3">{t('vehicles.insuranceTitle')}</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.insuranceCompany')}</dt><dd>{vehicle.insuranceCompany || '—'}</dd></div>
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.insuranceType')}</dt><dd>{getInsuranceLabel(vehicle.insuranceType, t)}</dd></div>
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.policyNo')}</dt><dd>{vehicle.insurancePolicyNo || '—'}</dd></div>
                  <div><dt className="text-dark-charcoal/60">{t('vehicles.insuranceExpiry')}</dt><dd className="flex items-center gap-1">
                    {vehicle.insuranceExpiryDate ? String(vehicle.insuranceExpiryDate).slice(0, 10) : '—'}
                    {(insuranceExpired || insuranceWarning) && vehicle.insuranceExpiryDate && (
                      <button
                        type="button"
                        onClick={() => setExpiryPopup({
                          config: { table: 'vehicles', column: 'insuranceExpiryDate', recordId: vehicleId },
                          documentConfig: { entityType: 'vehicle', entityId: vehicleId, section: 'insurance' },
                          currentExpiry: String(vehicle.insuranceExpiryDate).slice(0, 10),
                          title: t('vehicles.updateInsuranceExpiry'),
                        })}
                        className="text-primary-gold hover:underline text-xs"
                      >
                        {t('vehicles.update')}
                      </button>
                    )}
                  </dd></div>
                </dl>
                {insuranceExpired && <p className="text-alert-red text-sm flex items-center gap-1"><AlertTriangle size={16} /> {t('vehicles.expired')}</p>}
                {insuranceWarning && !insuranceExpired && <p className="text-yellow-700 text-sm flex items-center gap-1"><AlertTriangle size={16} /> {t('vehicles.expiringSoon')}</p>}
                {!insuranceExpired && !insuranceWarning && vehicle.insuranceExpiryDate && <p className="text-success-green text-sm flex items-center gap-1"><CheckCircle size={16} /> {t('vehicles.valid')}</p>}
              </div>
            </div>
          )}

          {activeTab === 'permits' && (
            <div className="space-y-4">
              <h3 className="text-primary-gold font-bold">{t('vehicles.permitsTitle')}</h3>
              {customFields.length === 0 ? (
                <p className="text-secondary-gray">{t('vehicles.noSections')}</p>
              ) : (
                <div className="space-y-3">
                  {customFields.map((f) => {
                    let rows: { key: string; value: string; isDate?: boolean }[] = [];
                    try {
                      if (f.content) {
                        const parsed = JSON.parse(f.content) as { rows?: { key: string; value: string; isDate?: boolean }[] };
                        rows = parsed?.rows ?? [];
                      }
                    } catch {}
                    return (
                      <div key={f.id} className="border border-secondary-gray/50 rounded-lg p-4">
                        <h4 className="font-medium text-dark-charcoal">{f.title}</h4>
                        {rows.length > 0 ? (
                          <dl className="mt-2 space-y-1 text-sm">
                            {rows.map((r, i) => (
                              <div key={i} className="flex gap-2">
                                <dt className="text-dark-charcoal/60 shrink-0">{r.key || '—'}:</dt>
                                <dd className="font-medium">{r.value || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-dark-charcoal/80 text-sm mt-1">{f.content || '—'}</p>
                        )}
                        {f.enableAlert && f.alertDate && (
                          <p className="text-sm mt-2 text-dark-charcoal/70">
                            <Calendar size={14} className="inline ml-1" />
                            {t('vehicles.alertBefore')} {String(f.alertDate).slice(0, 10)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="vehicle" entityId={vehicleId} entityName={vehicle.plateNumber} />
          )}

          {activeTab === 'documents' && (
            <div className="border border-secondary-gray rounded-lg p-6">
              <h3 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('vehicles.documentsTitle')}</h3>
              {documents.length === 0 ? (
                <div className="text-center py-10">
                  <FolderOpen className="mx-auto text-secondary-gray mb-3" size={44} />
                  <p className="text-secondary-gray">{t('vehicles.noDocuments')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {documents.map((d) => (
                    <div key={d.id} className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50">
                      {(() => {
                        const name = getDocumentDisplayName(d.customName ?? null, d.relativePath);
                        const ext = name.split('.').pop()?.toLowerCase();
                        const isPdf = ext === 'pdf';
                        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                        return isPdf ? <FileText className="w-10 h-10 text-red-600" /> : isImg ? <ImageIcon className="w-10 h-10 text-green-600" /> : <File className="w-10 h-10 text-secondary-gray" />;
                      })()}
                      <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">
                        {getDocumentDisplayName(d.customName ?? null, d.relativePath)}
                      </span>
                      <div className="flex gap-1 mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const name = getDocumentDisplayName(d.customName ?? null, d.relativePath);
                            const res = await window.electronAPI?.documentGetUrl?.(d.relativePath);
                            if (res?.success && res?.url) {
                              setDocPreview({ url: res.url, name, relativePath: d.relativePath });
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('branches.preview')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => window.electronAPI?.documentOpenExternal?.(d.relativePath)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('branches.downloadOpen')}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const name = getDocumentDisplayName(d.customName ?? null, d.relativePath);
                            if (!confirm(t('branches.confirmDeleteDoc', { name }))) return;
                            const res = await window.electronAPI?.documentDelete?.(d.id);
                            if (res?.success) loadVehicle();
                          }}
                          className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
                          title={t('branches.deleteDocument')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-secondary-gray flex gap-3 justify-end">
          {canArchive && <button
            type="button"
            onClick={() => setArchiveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Archive size={18} />
            {t('common.archive')}
          </button>}
          {canDelete && <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            {t('common.delete')}
          </button>}
        </div>
      </div>

      {expiryPopup && (
        <UpdateExpiryPopup
          isOpen={!!expiryPopup}
          onClose={() => setExpiryPopup(null)}
          onSaved={handleExpirySaved}
          config={expiryPopup.config}
          documentConfig={expiryPopup.documentConfig}
          currentExpiry={expiryPopup.currentExpiry}
          title={expiryPopup.title}
          activityLogParams={{
            module: 'vehicle',
            action: 'expiry_update',
            entityType: 'vehicle',
            entityId: vehicleId,
            details: `expiryUpdate::vehicle::{newDate}`,
          }}
        />
      )}

      <AssignResponsibleModal
        isOpen={assignResponsibleOpen}
        onClose={() => setAssignResponsibleOpen(false)}
        onSaved={loadVehicle}
        vehicleId={vehicleId}
        vehiclePlate={vehicle.plateNumber}
        currentEmployeeId={vehicle.responsibleEmployeeId ?? null}
        currentEmployerId={vehicle.responsibleEmployerId ?? null}
        currentResponsibleName={vehicle.responsibleName ?? null}
      />

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setArchiveConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <Archive size={28} />
              <h3 className="font-bold text-lg">{t('vehicles.confirmArchive')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('vehicles.confirmArchiveMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setArchiveConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button onClick={handleArchive} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('common.archive')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 size={28} />
              <h3 className="font-bold text-lg">{t('vehicles.confirmDelete')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('vehicles.confirmDeleteMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <AddVehicleModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadVehicle}
        editVehicleId={vehicleId}
      />
      <DocumentPreviewModal
        preview={docPreview}
        onClose={() => setDocPreview(null)}
        onOpenExternal={async (relativePath) => {
          if (relativePath) await window.electronAPI?.documentOpenExternal?.(relativePath);
        }}
      />
    </div>
  );
}
