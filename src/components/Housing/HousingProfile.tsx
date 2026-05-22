import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Home,
  FileText,
  FolderOpen,
  History,
  Users,
  Pencil,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Phone,
  Smartphone,
  Archive,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getEmirateLabel } from '../../constants/uae';
import { useLanguageStore } from '../../store/languageStore';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import HistoryTab from '../shared/HistoryTab';
import AddHousingModal from './AddHousingModal';
import AssignOccupantModal from './AssignOccupantModal';
import UpdateHousingExpiryModal from './UpdateHousingExpiryModal';
import { listDocuments, deleteDocumentById } from '../../services/documentService';
import { HOUSING_ICON_MAP } from '../Icons/HousingIcons';

type TabId = 'basic' | 'contract' | 'occupants' | 'phones' | 'history' | 'documents';

interface HousingDetails {
  id: number;
  code?: string;
  name: string;
  housingType: string;
  ownedBy: string;
  emirate?: string;
  address?: string;
  landlordName?: string;
  tenantDisplayName?: string;
  contractNo?: string;
  contractIssue?: string;
  contractExpiry?: string;
  rentAmount?: number;
  paymentMethod?: string;
  installmentsCount?: number;
  branchId?: number;
  branchName?: string;
  employeeId?: number;
  employeeName?: string;
  employerId?: number;
  employerName?: string;
  status?: string;
}

interface InstallmentRow {
  id: number;
  seq: number;
  dueDate?: string;
  amount: number;
  paid: number | boolean | string;
  paidAt?: string;
  note?: string;
}

interface OccupantRow {
  id: number;
  employeeId?: number;
  employeeName?: string;
  employerId?: number;
  employerName?: string;
  name?: string;
  role?: string;
  fromDate?: string;
  toDate?: string;
}

function installmentIsPaid(i: InstallmentRow): boolean {
  const p = i.paid;
  return p === 1 || p === true || p === '1';
}

export default function HousingProfile() {
  const { t } = useTranslation();
  const lang = useLanguageStore((s) => s.language);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const canEdit = useMemo(() => can('housing', 'edit'), [can]);
  const canDelete = useMemo(() => can('housing', 'delete'), [can]);
  const canArchive = canEdit;
  const ALL_TABS: { id: TabId; label: string; icon: typeof Home }[] = [
    { id: 'basic', label: t('housing.tabBasic'), icon: Home },
    { id: 'contract', label: t('housing.tabContract'), icon: FileText },
    { id: 'occupants', label: t('housing.tabOccupants'), icon: Users },
    { id: 'phones', label: t('housing.tabPhones'), icon: Phone },
    { id: 'history', label: t('housing.tabHistory'), icon: History },
    { id: 'documents', label: t('housing.tabDocuments'), icon: FolderOpen },
  ];
  // Filter tabs by permission
  const TABS = useMemo(() => ALL_TABS.filter((tab) => can('housing', `tab.${tab.id}`)), [can]);
  const [unit, setUnit] = useState<HousingDetails | null>(null);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [occupants, setOccupants] = useState<OccupantRow[]>([]);
  const [housingPhones, setHousingPhones] = useState<{ id: number; phoneNumber: string; provider: string; category: string; numberType: string; registeredName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignOccupantOpen, setAssignOccupantOpen] = useState(false);
  const [updateExpiryModalOpen, setUpdateExpiryModalOpen] = useState(false);
  const [removeOccupantId, setRemoveOccupantId] = useState<number | null>(null);
  const [installmentBusyId, setInstallmentBusyId] = useState<number | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteUnitConfirm, setDeleteUnitConfirm] = useState(false);

  const loadData = async () => {
    if (!id || !window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.dbQuery(
        `SELECT h.*, b.name as branchName,
                (SELECT name FROM employees WHERE id = h.employeeId) as employeeName,
                (SELECT fullName FROM employers WHERE id = h.employerId) as employerName
         FROM housing_units h
         LEFT JOIN branches b ON h.branchId = b.id
         WHERE h.id = ?`,
        [id]
      );
      const row = res?.data?.[0] as Record<string, unknown> | undefined;
      if (!row) {
        setUnit(null);
        setLoading(false);
        return;
      }
      setUnit({
        id: row.id as number,
        code: row.code as string | undefined,
        name: String(row.name ?? ''),
        housingType: String(row.housingType ?? 'labour'),
        ownedBy: String(row.ownedBy ?? 'company'),
        emirate: row.emirate as string | undefined,
        address: row.address as string | undefined,
        landlordName: row.landlordName as string | undefined,
        tenantDisplayName: row.tenantDisplayName as string | undefined,
        contractNo: row.contractNo as string | undefined,
        contractIssue: row.contractIssue ? String(row.contractIssue).slice(0, 10) : undefined,
        contractExpiry: row.contractExpiry ? String(row.contractExpiry).slice(0, 10) : undefined,
        rentAmount: row.rentAmount != null ? Number(row.rentAmount) : undefined,
        paymentMethod: row.paymentMethod as string | undefined,
        installmentsCount: row.installmentsCount != null ? Number(row.installmentsCount) : undefined,
        branchId: row.branchId as number | undefined,
        branchName: row.branchName as string | undefined,
        employeeId: row.employeeId as number | undefined,
        employeeName: row.employeeName as string | undefined,
        employerId: row.employerId as number | undefined,
        employerName: row.employerName as string | undefined,
        status: row.status as string | undefined,
      });

      const instRes = await window.electronAPI.dbQuery(
        'SELECT id, seq, dueDate, amount, paid, paidAt, note FROM housing_installments WHERE housingId = ? ORDER BY seq',
        [id]
      );
      setInstallments((instRes?.data ?? []) as InstallmentRow[]);

      const occRes = await window.electronAPI.dbQuery(
        `SELECT o.id, o.employeeId, o.employerId, o.name, o.role, o.fromDate, o.toDate,
                e.name as employeeName, emp.fullName as employerName
         FROM housing_occupants o
         LEFT JOIN employees e ON o.employeeId = e.id
         LEFT JOIN employers emp ON o.employerId = emp.id
         WHERE o.housingUnitId = ?
         ORDER BY o.fromDate DESC`,
        [id]
      );
      setOccupants((occRes?.data ?? []) as OccupantRow[]);

      const phonesRes = await window.electronAPI.dbQuery(
        `SELECT id, phoneNumber, provider, category, numberType, registeredName 
         FROM phones 
         WHERE assignedHousingId = ? AND (status IS NULL OR status != 'archived')`, 
        [id]
      );
      setHousingPhones(phonesRes?.data ?? []);
    } catch {
      setUnit(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveOccupant = async (occupantId: number) => {
    try {
      if (!window.electronAPI?.dbQuery) return;
      await window.electronAPI.dbQuery(
        'DELETE FROM housing_occupants WHERE id = ?',
        [occupantId]
      );
      
      const occupant = occupants.find(o => o.id === occupantId);
      await logActivity({
        module: 'housing',
        action: 'remove_occupant',
        entityType: 'housing',
        entityId: unit?.id,
        details: `removeOccupant::${occupant?.employeeName || occupant?.employerName || occupant?.name}::${unit?.name}`,
        performedByUserId: useAuthStore.getState().user?.id,
        performedByUsername: useAuthStore.getState().user?.username,
        performedByUserCode: useAuthStore.getState().user?.username,
      });

      loadData();
    } catch (err) {
      console.error('Error removing occupant', err);
      alert(t('housing.assignModal.saveError'));
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const authUser = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const performerLabel = authUser
    ? `${authUser.fullName || authUser.username}${authUser.entityId != null ? ` (${authUser.entityId})` : ''}`
    : t('housing.systemPerformer');

  const housingIdNum = id ? parseInt(id, 10) : NaN;

  const execDb = async (sql: string, params: unknown[] = []) => {
    const res = await window.electronAPI?.dbQuery?.(sql, params);
    if (!res?.success) {
      throw new Error(res?.error || 'DB_QUERY_FAILED');
    }
    return res;
  };

  /** Some deployments lack a child table; MariaDB 1146 / SQLite "no such table" — skip then rely on CASCADE or manual cleanup. */
  const execDbOptionalTable = async (sql: string, params: unknown[] = []) => {
    try {
      await execDb(sql, params);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/1146|42S02|no such table|doesn't exist|does not exist/i.test(msg)) return;
      throw e;
    }
  };

  const handleArchiveUnit = async () => {
    if ((!window.electronAPI?.archiveRecord && !window.electronAPI?.dbQuery) || !unit || Number.isNaN(housingIdNum)) return;
    try {
      if (window.electronAPI.archiveRecord) {
        const res = await window.electronAPI.archiveRecord(sessionToken, 'housing', housingIdNum);
        if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      } else {
        await execDb('UPDATE housing_units SET status = ? WHERE id = ?', ['archived', housingIdNum]);
      }
      const label = unit.name || unit.code || `housing ${housingIdNum}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'housing',
        entityId: housingIdNum,
        details: `archived::housing::${label}::${performerLabel}`,
        performedByUserId: authUser?.id,
        performedByUsername: authUser?.fullName || authUser?.username,
        performedByUserCode: authUser?.username,
      });
      setArchiveConfirm(false);
      navigate('/dashboard/housing');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : t('common.saveError'));
    }
  };

  const handleDeleteUnit = async () => {
    if ((!window.electronAPI?.archiveDeletePermanent && !window.electronAPI?.dbQuery) || !unit || Number.isNaN(housingIdNum)) return;
    try {
      try {
        const docRes = await listDocuments('housing', housingIdNum);
        const docs = docRes?.success && Array.isArray(docRes.data) ? docRes.data as { id: number }[] : [];
        for (const d of docs) {
          const delRes = await deleteDocumentById(d.id);
          if (!delRes?.success) {
            const err = String(delRes?.error || '');
            if (/NOT_FOUND|404|INVALID_ID|غير موجود/i.test(err)) continue;
            console.warn('housing delete: document file delete failed', d.id, err);
          }
        }
      } catch (docErr) {
        console.warn('housing delete: document cleanup (files) skipped', docErr);
      }
      if (window.electronAPI.archiveDeletePermanent) {
        const res = await window.electronAPI.archiveDeletePermanent(sessionToken, 'housing', housingIdNum);
        if (!res?.success) throw new Error(res?.error || 'DELETE_FAILED');
      } else {
        // Always drop document rows for this unit (covers remote file API quirks).
        await execDb('DELETE FROM documents WHERE entityType = ? AND entityId = ?', ['housing', housingIdNum]);
        await execDb('UPDATE phones SET assignedHousingId = NULL WHERE assignedHousingId = ?', [housingIdNum]);
        await execDb('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['housing', housingIdNum]);
        await execDbOptionalTable('DELETE FROM housing_installments WHERE housingId = ?', [housingIdNum]);
        await execDbOptionalTable('DELETE FROM housing_occupants WHERE housingUnitId = ?', [housingIdNum]);
        await execDbOptionalTable('DELETE FROM housing_custom_fields WHERE housingUnitId = ?', [housingIdNum]);
        await execDb('DELETE FROM housing_units WHERE id = ?', [housingIdNum]);
      }
      setDeleteUnitConfirm(false);
      navigate('/dashboard/housing');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : t('common.saveError'));
    }
  };

  const toggleInstallmentPaid = useCallback(
    async (row: InstallmentRow) => {
      if (!window.electronAPI?.dbQuery || !unit?.id) return;
      const nextPaid = !installmentIsPaid(row);
      setInstallmentBusyId(row.id);
      try {
        const res = await window.electronAPI.dbQuery(
          nextPaid
            ? 'UPDATE housing_installments SET paid = 1, paidAt = datetime(\'now\') WHERE id = ? AND housingId = ?'
            : 'UPDATE housing_installments SET paid = 0, paidAt = NULL WHERE id = ? AND housingId = ?',
          [row.id, unit.id]
        );
        if (!res?.success) {
          toast.error(res?.error || t('housing.installmentUpdateFailed'));
          return;
        }
        await logActivity({
          module: 'housing',
          action: nextPaid ? 'installment_mark_paid' : 'installment_mark_unpaid',
          entityType: 'housing',
          entityId: unit.id,
          details: `housingInstallment::${row.id}::seq ${row.seq + 1}::${nextPaid ? 'paid' : 'unpaid'}`,
          performedByUserId: useAuthStore.getState().user?.id,
          performedByUsername: useAuthStore.getState().user?.username,
          performedByUserCode: useAuthStore.getState().user?.username,
        });
        toast.success(nextPaid ? t('housing.installmentMarkedPaid') : t('housing.installmentMarkedUnpaid'));
        await loadData();
      } catch {
        toast.error(t('housing.installmentUpdateFailed'));
      } finally {
        setInstallmentBusyId(null);
      }
    },
    [t, unit?.id]
  );

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-secondary-gray">{t('housing.loading')}</p>
      </div>
    );
  }
  if (!unit) {
    return (
      <div className="p-6">
        <p className="text-secondary-gray">{t('housing.unitNotFound')}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/housing')}
          className="mt-4 text-primary-gold hover:underline"
        >
          {t('housing.back')}
        </button>
      </div>
    );
  }

  const contractDaysLeft = unit.contractExpiry
    ? Math.ceil((new Date(unit.contractExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const contractStatus = contractDaysLeft == null ? null : contractDaysLeft < 0 ? 'expired' : contractDaysLeft <= 30 ? 'warning' : 'ok';

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard/housing')}
        className="flex items-center gap-2 text-dark-charcoal/70 hover:text-primary-gold"
      >
        <ArrowRight size={20} className="rotate-180" />
        {t('housing.back')}
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {(() => {
            const Icon = HOUSING_ICON_MAP[unit.housingType as keyof typeof HOUSING_ICON_MAP] || HOUSING_ICON_MAP['labour'];
            return <Icon size={32} className="text-primary-gold shrink-0" />;
          })()}
          <div>
            {unit.code && (
              <span className="inline-block px-2.5 py-1 rounded bg-gray-200 text-dark-charcoal/80 text-xs font-medium mb-2">
                {unit.code}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">{unit.name}</h1>
            <p className="text-sm text-dark-charcoal/60 mt-1">
              {t(`housing.types.${unit.housingType === 'family' ? 'personal' : unit.housingType}`)} · {t(`housing.ownedByOptions.${unit.ownedBy}`)}
            </p>
            {unit.contractExpiry && contractStatus && (
              <span className={`inline-flex items-center gap-1 mt-2 text-sm ${
                contractStatus === 'expired' ? 'text-alert-red' : contractStatus === 'warning' ? 'text-yellow-700' : 'text-success-green'
              }`}>
                {contractStatus === 'ok' && <CheckCircle size={16} />}
                {contractStatus === 'warning' && <AlertTriangle size={16} />}
                {contractStatus === 'expired' && <span>{t('housing.contractExpiredLabel')}</span>}
                {contractDaysLeft != null && contractDaysLeft >= 0 && (
                  <span>{t('housing.contractExpiresIn', { count: contractDaysLeft })}</span>
                )}
                {contractDaysLeft != null && contractDaysLeft < 0 && (
                  <span>{t('housing.contractExpiredDays', { count: Math.abs(contractDaysLeft) })}</span>
                )}
              </span>
            )}
          </div>
        </div>
        {canEdit && <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
        >
          <Pencil size={18} />
          {t('housing.edit')}
        </button>}
      </div>

      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      <TabsOrDropdown
        tabs={TABS.map(t => t.id === 'phones' && housingPhones.length > 0 ? { ...t, badge: housingPhones.length } : t) as any}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        extra={null}
      />

      <div className="bg-white rounded-lg border border-secondary-gray p-6">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <div className="min-h-[3rem] flex flex-col justify-center py-1">
                <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.unitType')}</p>
                <p className="font-medium text-dark-charcoal">{t(`housing.types.${unit.housingType === 'family' ? 'personal' : unit.housingType}`)}</p>
              </div>
              <div className="min-h-[3rem] flex flex-col justify-center py-1">
                <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.ownedBy')}</p>
                <p className="font-medium text-dark-charcoal">{t(`housing.ownedByOptions.${unit.ownedBy}`)}</p>
              </div>
              {unit.emirate && (
                <div className="min-h-[3rem] flex flex-col justify-center py-1">
                  <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.emirate')}</p>
                  <p className="font-medium text-dark-charcoal">{unit.emirate ? getEmirateLabel(unit.emirate, lang) : '—'}</p>
                </div>
              )}
              {unit.tenantDisplayName && (
                <div className="min-h-[3rem] flex flex-col justify-center py-1">
                  <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.tenant')}</p>
                  <p className="font-medium text-dark-charcoal">{unit.tenantDisplayName}</p>
                </div>
              )}
              {unit.branchName && (
                <div className="min-h-[3rem] flex flex-col justify-center py-1">
                  <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.linkedBranch')}</p>
                  <p className="font-medium text-primary-gold">{unit.branchName}</p>
                </div>
              )}
              {unit.employeeName && (
                <div className="min-h-[3rem] flex flex-col justify-center py-1">
                  <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.employeeContractName')}</p>
                  <p className="font-medium text-dark-charcoal">{unit.employeeName}</p>
                </div>
              )}
              {unit.employerName && (
                <div className="min-h-[3rem] flex flex-col justify-center py-1">
                  <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.employerContractName')}</p>
                  <p className="font-medium text-dark-charcoal">{unit.employerName}</p>
                </div>
              )}
            </div>
            {unit.address && (
              <div className="pt-4 border-t border-secondary-gray/30">
                <p className="text-xs text-dark-charcoal/60 mb-1">{t('housing.address')}</p>
                <p className="font-medium text-dark-charcoal">{unit.address}</p>
              </div>
            )}
            {housingPhones.length > 0 && (
              <div className="pt-4 border-t border-secondary-gray/30">
                <p className="text-xs text-dark-charcoal/60 mb-2">{t('housing.contactNumbers')}</p>
                <div className="flex flex-wrap gap-2">
                  {housingPhones.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 bg-primary-gold/10 text-primary-gold font-medium px-3 py-1.5 rounded" dir="ltr">
                      {p.numberType === 'landline' ? <Phone size={14} /> : <Smartphone size={14} />}
                      {p.phoneNumber}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contract' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-xs text-dark-charcoal/60 mb-0.5">{t('housing.landlord')}</p><p className="font-medium">{unit.landlordName || '—'}</p></div>
              <div><p className="text-xs text-dark-charcoal/60 mb-0.5">{t('housing.contractNo')}</p><p className="font-medium">{unit.contractNo || '—'}</p></div>
              <div><p className="text-xs text-dark-charcoal/60 mb-0.5">{t('housing.issueDate')}</p><p className="font-medium">{unit.contractIssue || '—'}</p></div>
              <div>
                <p className="text-xs text-dark-charcoal/60 mb-0.5">{t('housing.expiryDate')}</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{unit.contractExpiry || '—'}</span>
                  <button
                    type="button"
                    onClick={() => setUpdateExpiryModalOpen(true)}
                    className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                  >
                    {t('housing.update')}
                  </button>
                </div>
              </div>
              <div><p className="text-xs text-dark-charcoal/60 mb-0.5">{t('housing.contractValue')}</p><p className="font-medium">{unit.rentAmount != null ? `${unit.rentAmount.toLocaleString('en')} ${t('housing.aed')}` : '—'}</p></div>
            </div>
            <h4 className="text-primary-gold font-medium flex flex-wrap items-center gap-2">
              <Calendar size={18} aria-hidden />
              {t('housing.installmentsTitle')}
              <span className="text-sm font-normal text-dark-charcoal/70">{t('housing.installmentsHint')}</span>
            </h4>
            {installments.length === 0 ? (
              <p className="text-secondary-gray text-sm">{t('housing.noInstallments')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border border-secondary-gray/50 rounded-lg">
                  <thead className="bg-light-background">
                    <tr>
                      <th className="p-3 font-medium text-dark-charcoal">#</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.dueDate')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.amount')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.installmentStatus')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.paidAt')}</th>
                      {installments.some((inst) => inst.note) && (
                        <th className="p-3 font-medium text-dark-charcoal">{t('housing.notes')}</th>
                      )}
                      <th className="p-3 font-medium text-dark-charcoal w-44">{t('housing.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((i) => {
                      const paid = installmentIsPaid(i);
                      const paidAtDisplay = i.paidAt ? String(i.paidAt).replace('T', ' ').slice(0, 16) : '—';
                      return (
                        <tr key={i.id} className="border-t border-secondary-gray/30">
                          <td className="p-3">{i.seq + 1}</td>
                          <td className="p-3">{i.dueDate || '—'}</td>
                          <td className="p-3">{Number(i.amount).toLocaleString('en')}</td>
                          <td className="p-3">
                            <span
                              className={
                                paid ? 'text-success-green font-medium' : 'text-dark-charcoal/70'
                              }
                            >
                              {paid ? t('housing.installmentPaidLabel') : t('housing.installmentUnpaidLabel')}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-dark-charcoal/80">{paid ? paidAtDisplay : '—'}</td>
                          {installments.some((inst) => inst.note) && <td className="p-3">{i.note || '—'}</td>}
                          <td className="p-3">
                            <button
                              type="button"
                              disabled={installmentBusyId === i.id}
                              onClick={() => toggleInstallmentPaid(i)}
                              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                paid
                                  ? 'bg-secondary-gray/25 text-dark-charcoal hover:bg-secondary-gray/40'
                                  : 'bg-success-green text-white hover:opacity-90'
                              }`}
                            >
                              {installmentBusyId === i.id
                                ? t('common.saving')
                                : paid
                                  ? t('housing.markInstallmentUnpaid')
                                  : t('housing.markInstallmentPaid')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'occupants' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-primary-gold font-medium flex items-center gap-2"><Users size={18} /> {t('housing.tabOccupants')}</h4>
              <button
                type="button"
                onClick={() => setAssignOccupantOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
              >
                {t('housing.assignOccupants')}
              </button>
            </div>
            {occupants.length === 0 ? (
              <p className="text-secondary-gray text-sm">{t('housing.noOccupants')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border border-secondary-gray/50 rounded-lg">
                  <thead className="bg-light-background">
                    <tr>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.name')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.role')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.fromDate')}</th>
                      <th className="p-3 font-medium text-dark-charcoal">{t('housing.toDate')}</th>
                      <th className="p-3 font-medium text-dark-charcoal w-16 text-center">{t('housing.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupants.map((o) => (
                      <tr key={o.id} className="border-t border-secondary-gray/30">
                        <td className="p-3 font-medium">{o.employeeName || o.employerName || o.name || '—'}</td>
                        <td className="p-3">{o.role || '—'}</td>
                        <td className="p-3">{o.fromDate || '—'}</td>
                        <td className="p-3">{o.toDate || '—'}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setRemoveOccupantId(o.id);
                            }}
                            className="p-1.5 rounded-lg text-alert-red hover:bg-alert-red/10 transition-colors cursor-pointer"
                            title={t('housing.removeOccupant')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab
            entityType="housing"
            entityId={unit.id}
            entityName={unit.name}
          />
        )}

        {activeTab === 'documents' && (
          <p className="text-secondary-gray text-sm">{t('housing.documentsHint')}</p>
        )}

        {(activeTab as string) === 'phones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary-gray/50">
              <h4 className="font-bold text-lg text-primary-gold">{t('housing.phonesTitle')}</h4>
            </div>
            {housingPhones.length === 0 ? (
              <p className="text-secondary-gray py-8 text-center text-lg">{t('housing.noPhones')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {housingPhones.map((p) => (
                  <div key={p.id} onClick={() => navigate(`/dashboard/phones/${p.id}`)} className="border border-secondary-gray/30 p-4 rounded-lg flex items-center justify-between hover:border-primary-gold/50 transition-colors cursor-pointer bg-light-background">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-gray/20 flex items-center justify-center shrink-0 text-primary-gold">
                        {p.numberType === 'landline' ? <Phone size={20} /> : <Smartphone size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-dark-charcoal text-lg" dir="ltr">{p.phoneNumber}</p>
                        <p className="text-sm text-secondary-gray mt-1">{p.provider === 'etisalat' ? t('employees.providerEtisalat') : p.provider === 'du' ? t('employees.providerDu') : p.provider} - {p.category === 'prepaid' ? t('employees.categoryPrepaid') : t('employees.categoryPostpaid')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-secondary-gray flex gap-3 justify-end">
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
            onClick={() => setDeleteUnitConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            {t('common.delete')}
          </button>}
        </div>
      </div>

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setArchiveConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <Archive size={28} />
              <h3 className="font-bold text-lg">{t('housing.profileConfirmArchive')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('housing.profileConfirmArchiveMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setArchiveConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button type="button" onClick={handleArchiveUnit} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('common.archive')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteUnitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteUnitConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 size={28} />
              <h3 className="font-bold text-lg">{t('housing.profileConfirmDelete')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('housing.profileConfirmDeleteMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteUnitConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button type="button" onClick={handleDeleteUnit} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <AddHousingModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadData}
        editHousingId={unit.id}
      />
      <AssignOccupantModal
        isOpen={assignOccupantOpen}
        onClose={() => setAssignOccupantOpen(false)}
        onSuccess={loadData}
        housingUnitId={unit.id}
        housingUnitName={unit.name}
        emirate={unit.emirate}
      />
      <UpdateHousingExpiryModal
        isOpen={updateExpiryModalOpen}
        onClose={() => setUpdateExpiryModalOpen(false)}
        onSaved={() => { setUpdateExpiryModalOpen(false); loadData(); }}
        housingId={unit.id}
        housingName={unit.name}
        currentExpiry={unit.contractExpiry || ''}
        installments={installments.map((i) => ({ id: i.id, seq: i.seq, amount: i.amount, dueDate: i.dueDate, note: i.note }))}
      />
      {/* Remove Occupant Modal */}
      {removeOccupantId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-dark-charcoal mb-4">{t('housing.confirmDeleteTitle')}</h3>
            <p className="text-secondary-gray mb-6">{t('housing.confirmRemoveOccupant')}</p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  handleRemoveOccupant(removeOccupantId);
                  setRemoveOccupantId(null);
                }}
                className="flex-1 bg-alert-red text-white py-2 rounded-lg font-medium hover:bg-opacity-90 transition-colors shadow-sm"
              >
                {t('housing.confirmAndDelete')}
              </button>
              <button
                type="button"
                onClick={() => setRemoveOccupantId(null)}
                className="flex-1 bg-secondary-gray/20 text-dark-charcoal py-2 rounded-lg font-medium hover:bg-secondary-gray/30 transition-colors"
              >
                {t('housing.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
