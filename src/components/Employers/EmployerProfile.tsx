import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { logActivity } from '../../utils/activityLog';
import HistoryTab from '../shared/HistoryTab';
import { ArrowRight, Edit2, Archive, Trash2, Building2, User, FileText, History, CreditCard, FolderOpen, Plus, Unlink, RefreshCw, Eye, Phone, Star, Pencil, Download, File, Image as ImageIcon } from 'lucide-react';
import AddEmployerModal from './AddEmployerModal';
import LinkBranchModal, { type EditLinkValue } from './LinkBranchModal';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import DocumentPreviewModal from '../shared/DocumentPreviewModal';
import UpdateExpiryPopup, { type UpdateExpiryConfig, type DocumentLinkConfig } from '../shared/UpdateExpiryPopup';
import { UAE_EMIRATES } from '../../constants/uae';
import { listDocuments, getDocumentUrl, openDocumentExternal, deleteDocumentById } from '../../services/documentService';
import { getDocumentDisplayName, isPdfDocumentName, isImageDocumentName } from '../../utils/documentHelpers';
import type { DocumentPreview, DocumentListItem } from '../../types/documents';

interface EmployerPhone {
  id: number;
  phoneNumber: string;
}
interface EmployerData {
  id: number; code: string; fullName: string; fullNameEn?: string;
  nationality?: string; phone?: string; email?: string; photoPath?: string;
  primaryPhoneId?: number | null;
  passportNumber?: string; passportIssueDate?: string; passportExpiry?: string; passportCountry?: string;
  emiratesId?: string; emiratesIdIssueDate?: string; emiratesIdExpiry?: string;
  issueEmirate?: string;
  occupation?: string; notes?: string; status: string;
  branches: BranchLink[];
}
interface BranchLink { id: number; branchId: number; branchName: string; branchCode: string; branchTradeName?: string; role: string; ownershipPercent?: number; }

const ROLE_KEYS: Record<string, string> = { owner: 'employers.roleOwner', partner: 'employers.rolePartner', manager: 'employers.roleManager', agent: 'employers.roleAgent' };

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-dark-charcoal/5 last:border-0">
      <span className="text-xs text-dark-charcoal/50 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-dark-charcoal font-medium flex-1">{value}</span>
    </div>
  );
}

function ExpiryInfo({ label, date, t }: { label: string; date?: string; t: (k: string, opts?: { count?: number }) => string }) {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? 'text-red-600 bg-red-50' : days < 30 ? 'text-amber-600 bg-amber-50' : days < 90 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';
  const status = days < 0 ? t('employers.expiredDays') : t('employers.daysLeft', { count: days });
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-dark-charcoal/5 last:border-0">
      <div>
        <span className="text-xs text-dark-charcoal/50 block">{label}</span>
        <span className="text-sm font-medium">{new Date(date).toLocaleDateString('en')}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full font-bold ${color}`}>{status}</span>
    </div>
  );
}

export default function EmployerProfile() {
  const { t } = useTranslation();
  const dir = useLanguageStore((s) => s.dir);
  const user = useAuthStore((s) => s.user);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = useMemo(() => can('employers', 'edit'), [can]);
  const canDelete = useMemo(() => can('employers', 'delete'), [can]);
  const canArchive = canEdit;
  const TABS = useMemo(() => {
    const TAB_MAP: Record<string, string> = { 'basic': 'tab.basic', 'passport-residency': 'tab.passportResidency', 'branches': 'tab.branches', 'docs': 'tab.docs', 'history': 'tab.history' };
    return [
      { id: 'basic', label: t('employers.tabBasic'), icon: User },
      { id: 'passport-residency', label: t('employers.tabPassportResidency'), icon: CreditCard },
      { id: 'branches', label: t('employers.tabBranches'), icon: Building2 },
      { id: 'docs', label: t('employers.tabDocs'), icon: FolderOpen },
      { id: 'history', label: t('employers.tabHistory'), icon: History },
    ].filter((tab) => can('employers', TAB_MAP[tab.id] || `tab.${tab.id}`));
  }, [t, can]);
  const [employer, setEmployer] = useState<EmployerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('basic');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editLink, setEditLink] = useState<EditLinkValue | null>(null);
  const [docFiles, setDocFiles] = useState<DocumentListItem[]>([]);
  const [docPreview, setDocPreview] = useState<DocumentPreview | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [employerPhones, setEmployerPhones] = useState<EmployerPhone[]>([]);
  const [expiryPopup, setExpiryPopup] = useState<{
    config: UpdateExpiryConfig;
    documentConfig?: DocumentLinkConfig;
    currentExpiry?: string;
    title: string;
    activityLogParams?: { module: string; action: string; entityType: string; entityId?: number; details: string };
  } | null>(null);

  const groupedBranchLinks = useMemo(() => {
    if (!employer?.branches?.length) return [];
    const byBranch = new Map<number, {
      id: number;
      branchId: number;
      branchName: string;
      branchCode: string;
      branchTradeName?: string;
      roles: string[];
      ownershipPercent?: number;
    }>();
    employer.branches.forEach((b) => {
      const existing = byBranch.get(b.branchId);
      if (existing) {
        if (!existing.roles.includes(b.role)) existing.roles.push(b.role);
        if (existing.ownershipPercent == null && b.ownershipPercent != null) existing.ownershipPercent = b.ownershipPercent;
        return;
      }
      byBranch.set(b.branchId, {
        id: b.id,
        branchId: b.branchId,
        branchName: b.branchName,
        branchCode: b.branchCode,
        branchTradeName: b.branchTradeName,
        roles: [b.role],
        ownershipPercent: b.ownershipPercent,
      });
    });
    return Array.from(byBranch.values());
  }, [employer?.branches]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await (window as any).electronAPI.employerGet(Number(id));
      setEmployer(data);
      if (data?.photoPath && window.electronAPI?.fileGetImageUrl) {
        const res = await window.electronAPI.fileGetImageUrl(data.photoPath) as { url?: string } | undefined;
        setPhotoUrl(res?.url ?? '');
      } else {
        setPhotoUrl('');
      }
      if (window.electronAPI?.dbQuery) {
        const res = await window.electronAPI.dbQuery(
          'SELECT id, phoneNumber FROM phones WHERE assignedEmployerId = ? AND (status IS NULL OR status != ?) ORDER BY id',
          [Number(id), 'archived']
        );
        const list = (res?.data ?? res) as EmployerPhone[];
        setEmployerPhones(Array.isArray(list) ? list : []);
      }
    } finally { setLoading(false); }
  }, [id]);

  const loadDocs = useCallback(async () => {
    if (!id) return;
    const res = await listDocuments('employer', Number(id));
    const raw = (res?.success && Array.isArray(res?.data) ? res.data : []) as DocumentListItem[];
    setDocFiles(raw);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'docs' || tab === 'passport-residency') loadDocs();
  }, [tab, loadDocs]);

  const handleUnlink = async (branchId: number, role?: string) => {
    if (!employer) return;
    await (window as any).electronAPI.employerUnlinkBranch({ employerId: employer.id, branchId, role });
    load();
  };

  const handleArchive = async () => {
    if (!employer) return;
    if (employer.status === 'archived') {
      await (window as any).electronAPI.employerRestore(employer.id);
      logActivity({
        userId: user?.id,
        username: user?.username || 'unknown',
        module: 'archive',
        action: 'restore',
        entityType: 'employer',
        entityId: employer.id,
        details: `restored::employer::${employer.fullName}::${user?.fullName || user?.username || ''}`,
      });
    } else {
      await (window as any).electronAPI.employerArchive(employer.id);
      if (window.electronAPI?.dbQuery) {
        await window.electronAPI.dbQuery('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employer', employer.id]);
      }
      logActivity({
        userId: user?.id,
        username: user?.username || 'unknown',
        module: 'archive',
        action: 'archive',
        entityType: 'employer',
        entityId: employer.id,
        details: `archived::employer::${employer.fullName}::${user?.fullName || user?.username || ''}`,
      });
    }
    load();
  };

  const handleDelete = async () => {
    if (!employer) return;
    await (window as any).electronAPI.employerDelete(employer.id);
    navigate('/dashboard/employers');
  };

  const handleDocPreview = async (item: DocumentListItem) => {
    const res = await getDocumentUrl(item.relativePath);
    const url = (res as { url?: string })?.url ?? '';
    if (url) setDocPreview({ url, name: item.customName || item.relativePath.replace(/^.*[/\\]/, '') || t('employers.documentLabel'), relativePath: item.relativePath });
  };

  const setPrimaryPhone = async (phoneId: number) => {
    if (!employer || !window.electronAPI?.dbQuery) return;
    await window.electronAPI.dbQuery('UPDATE employers SET primaryPhoneId = ? WHERE id = ?', [phoneId, employer.id]);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw size={40} className="animate-spin text-primary-gold/50" />
    </div>
  );

  if (!employer) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-dark-charcoal/40" dir={dir}>
      <p className="text-lg">{t('employers.profileNotFound')}</p>
      <button onClick={() => navigate('/dashboard/employers')} className="text-primary-gold hover:underline text-sm">{t('employers.backToList')}</button>
    </div>
  );

  return (
    <div className="flex flex-col bg-light-background animate-in fade-in duration-200" dir={dir}>
      {/* Back */}
      <div className="flex justify-start mb-2">
        <button onClick={() => navigate('/dashboard/employers')} className="p-2 rounded-lg text-dark-charcoal hover:text-primary-gold hover:bg-primary-gold/10 transition-colors" aria-label={t('employers.backToList')}>
          <ArrowRight size={24} />
        </button>
      </div>

      {/* Header: صورة كبيرة يمين، الاسم والكود والمهنة في الوسط، الحالة يسار (مثل الموظفين) */}
      <div className="flex flex-row items-center justify-between gap-6 mb-6">
        <div className="shrink-0">
          {photoUrl ? (
            <div className="w-40 h-40 rounded-xl overflow-hidden border-2 border-primary-gold/30 shadow-md">
              <img src={photoUrl} alt={employer.fullName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-xl bg-primary-gold/10 flex items-center justify-center border-2 border-primary-gold/20">
              <User className="text-primary-gold/50" size={56} />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
          {employer.code && (
            <span className="inline-block px-2.5 py-1 rounded bg-gray-200 text-dark-charcoal/80 text-xs font-medium mb-2 font-mono">
              {employer.code}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">{employer.fullName}</h1>
          {employer.occupation && <p className="text-sm text-dark-charcoal/60 mt-1">{t('employers.occupationLabel')}: {employer.occupation}</p>}
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className={`inline-block px-5 py-2.5 rounded-full text-base font-medium ${employer.status === 'archived' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
            {employer.status === 'archived' ? t('employers.statusArchived') : t('employers.statusActive')}
          </span>
        </div>
      </div>

      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      {/* أزرار التعديل وربط الأفرع فوق التبويبات (صف مستقل) */}
      <div className="shrink-0 flex items-center gap-2 justify-end mb-4">
        <button type="button" onClick={() => { setTab('branches'); setShowLinkModal(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-primary-gold text-primary-gold hover:bg-primary-gold/10 font-medium">
          <Building2 size={18} /> {t('employers.linkBranches')}
        </button>
        {canEdit && <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-primary-gold/90 font-medium">
          <Edit2 size={18} /> {t('employers.edit')}
        </button>}
      </div>

      {/* التبويبات فقط (تحت الأزرار) */}
      <div className="mb-4">
        <TabsOrDropdown tabs={TABS} activeTab={tab} onTabChange={setTab} />
      </div>

      {/* Body — بدون مربع scroll داخلي؛ الصفحة كاملة تتحرك مثل الموظفين والأفرع */}
      <div className="p-6">

        {/* تبويب المعلومات الأساسية والجنسية */}
        {tab === 'basic' && (
          <div className="bg-white rounded-xl border border-dark-charcoal/10 p-6">
            <h3 className="text-sm font-bold text-dark-charcoal mb-4 flex items-center gap-2"><User size={14} /> {t('employers.personalInfo')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label={t('employers.nameAr')} value={employer.fullName} />
              <InfoRow label={t('employers.nameEn')} value={employer.fullNameEn} />
              <InfoRow label={t('employers.nationality')} value={employer.nationality} />
              <InfoRow label={t('employers.email')} value={employer.email} />
              {(employer.primaryPhoneId
                ? employerPhones.find((ph) => ph.id === employer.primaryPhoneId)?.phoneNumber
                : employerPhones[0]?.phoneNumber || employer.phone) && (
                <InfoRow
                  label={t('employers.workPhoneMain')}
                  value={
                    employer.primaryPhoneId
                      ? employerPhones.find((ph) => ph.id === employer.primaryPhoneId)?.phoneNumber
                      : employerPhones[0]?.phoneNumber || employer.phone
                  }
                />
              )}
              {!employer.primaryPhoneId && employer.phone && employerPhones.length > 0 && employer.phone !== employerPhones[0]?.phoneNumber && (
                <InfoRow label={t('employers.phoneOld')} value={employer.phone} />
              )}
              {!employer.primaryPhoneId && !employerPhones.length && <InfoRow label={t('employers.phone')} value={employer.phone} />}
            </div>
            {employerPhones.length > 1 && (
              <div className="mt-4 pt-4 border-t border-dark-charcoal/5">
                <p className="text-xs text-dark-charcoal/50 mb-2 flex items-center gap-1"><Phone size={12} /> {t('employers.workPhonesLinked')}</p>
                <ul className="space-y-1">
                  {employerPhones.map((ph) => (
                    <li key={ph.id} className="flex items-center justify-between text-sm">
                      <span dir="ltr" className="font-medium">{ph.phoneNumber}</span>
                      <button
                        type="button"
                        onClick={() => setPrimaryPhone(ph.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${employer.primaryPhoneId === ph.id ? 'bg-primary-gold/20 text-primary-gold' : 'text-dark-charcoal/60 hover:bg-primary-gold/10'}`}
                        title={employer.primaryPhoneId === ph.id ? t('employers.primary') : t('employers.setAsPrimary')}
                      >
                        <Star size={12} fill={employer.primaryPhoneId === ph.id ? 'currentColor' : 'none'} />
                        {employer.primaryPhoneId === ph.id ? t('employers.primary') : t('employers.setAsPrimary')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {employer.notes && <div className="mt-4 pt-4 border-t border-dark-charcoal/5"><p className="text-xs text-dark-charcoal/50 mb-1">{t('employers.notes')}</p><p className="text-sm text-dark-charcoal/70">{employer.notes}</p></div>}
          </div>
        )}

        {/* تبويب معلومات الجواز والإقامة */}
        {tab === 'passport-residency' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-dark-charcoal/10 p-5">
              <h3 className="text-sm font-bold text-dark-charcoal mb-4 flex items-center gap-2"><FileText size={14} /> {t('employers.passportSection')}</h3>
              <InfoRow label={t('employers.passportNumber')} value={employer.passportNumber} />
              <InfoRow label={t('employers.country')} value={employer.passportCountry} />
              <InfoRow label={t('employers.issueDate')} value={employer.passportIssueDate ? new Date(employer.passportIssueDate).toLocaleDateString('en') : undefined} />
              <div className="flex items-center justify-between py-2.5 border-b border-dark-charcoal/5 last:border-0">
                <div>
                  <span className="text-xs text-dark-charcoal/50 block">{t('employers.expiryDate')}</span>
                  <span className="text-sm font-medium">{employer.passportExpiry ? new Date(employer.passportExpiry).toLocaleDateString('en') : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {employer.passportExpiry && (() => {
                    const days = Math.ceil((new Date(employer.passportExpiry).getTime() - Date.now()) / 86400000);
                    const showUpdate = days <= 30 || days < 0;
                    const color = days < 0 ? 'text-red-600 bg-red-50' : days < 30 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';
                    return (
                      <>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${color}`}>{days < 0 ? t('employers.expiredDays') : t('employers.daysLeft', { count: days })}</span>
                        {showUpdate && (
                          <button
                            type="button"
                            onClick={() => setExpiryPopup({
                              config: { table: 'employers', column: 'passportExpiry', recordId: employer.id },
                              documentConfig: { entityType: 'employer', entityId: employer.id, section: 'passport_expiry' },
                              currentExpiry: employer.passportExpiry ? String(employer.passportExpiry).slice(0, 10) : undefined,
                              title: t('employers.updatePassportExpiry'),
                              activityLogParams: { module: 'employer', action: 'expiry_update', entityType: 'employer', entityId: employer.id, details: 'expiryUpdate::passport::{newDate}' }
                            })}
                            className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-primary-gold/90"
                          >
                            {t('employers.update')}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {docFiles.some((d) => (d.section || '').toLowerCase().includes('passport') || (d.customName || '').toLowerCase().includes('جواز')) && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const passportDoc = docFiles.find((d) => (d.section || '').toLowerCase().includes('passport') || (d.customName || '').toLowerCase().includes('جواز'));
                      if (passportDoc) handleDocPreview(passportDoc);
                    }}
                    className="p-1.5 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10"
                    title={t('employers.previewPassport')}
                  >
                    <Eye size={18} />
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-dark-charcoal/10 p-5">
              <h3 className="text-sm font-bold text-dark-charcoal mb-4 flex items-center gap-2"><CreditCard size={14} /> {t('employers.emiratesIdResidency')}</h3>
              <InfoRow label={t('employers.emiratesIdNumber')} value={employer.emiratesId} />
              <InfoRow label={t('employers.issueEmirate')} value={employer.issueEmirate ? UAE_EMIRATES.find((e) => e.value === employer.issueEmirate)?.label ?? employer.issueEmirate : undefined} />
              <InfoRow label={t('employers.occupationLabel')} value={employer.occupation} />
              <InfoRow label={t('employers.issueDate')} value={employer.emiratesIdIssueDate ? new Date(employer.emiratesIdIssueDate).toLocaleDateString('en') : undefined} />
              <div className="flex items-center justify-between py-2.5 border-b border-dark-charcoal/5 last:border-0">
                <div>
                  <span className="text-xs text-dark-charcoal/50 block">{t('employers.expiryDate')}</span>
                  <span className="text-sm font-medium">{employer.emiratesIdExpiry ? new Date(employer.emiratesIdExpiry).toLocaleDateString('en') : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {employer.emiratesIdExpiry && (() => {
                    const days = Math.ceil((new Date(employer.emiratesIdExpiry).getTime() - Date.now()) / 86400000);
                    const showUpdate = days <= 30 || days < 0;
                    const color = days < 0 ? 'text-red-600 bg-red-50' : days < 30 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';
                    return (
                      <>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${color}`}>{days < 0 ? t('employers.expiredDays') : t('employers.daysLeft', { count: days })}</span>
                        {showUpdate && (
                          <button
                            type="button"
                            onClick={() => setExpiryPopup({
                              config: { table: 'employers', column: 'emiratesIdExpiry', recordId: employer.id },
                              documentConfig: { entityType: 'employer', entityId: employer.id, section: 'emirates_id_expiry' },
                              currentExpiry: employer.emiratesIdExpiry ? String(employer.emiratesIdExpiry).slice(0, 10) : undefined,
                              title: t('employers.updateEmiratesIdExpiry'),
                              activityLogParams: { module: 'employer', action: 'expiry_update', entityType: 'employer', entityId: employer.id, details: 'expiryUpdate::emiratesId::{newDate}' }
                            })}
                            className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-primary-gold/90"
                          >
                            {t('employers.update')}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {docFiles.some((d) => (d.section || '').toLowerCase().includes('residency') || (d.section || '').toLowerCase().includes('emirates') || (d.customName || '').toLowerCase().includes('هوية')) && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const idDoc = docFiles.find((d) => (d.section || '').toLowerCase().includes('residency') || (d.section || '').toLowerCase().includes('emirates') || (d.customName || '').toLowerCase().includes('هوية'));
                      if (idDoc) handleDocPreview(idDoc);
                    }}
                    className="p-1.5 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10"
                    title={t('employers.previewEmiratesId')}
                  >
                    <Eye size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* تبويب الأفرع — عرض الأفرع المرتبطة فقط؛ الربط من نافذة منفصلة */}
        {tab === 'branches' && (
          <div className="space-y-4">
            <h3 className="font-bold text-dark-charcoal">{t('employers.linkedBranches')}</h3>
            {groupedBranchLinks.length === 0 ? (
              <div className="bg-white rounded-xl border border-dark-charcoal/10 p-8 flex flex-col items-center gap-3 text-dark-charcoal/40">
                <Building2 size={40} />
                <p>{t('employers.noLinkedBranches')}</p>
                <p className="text-sm">{t('employers.useLinkBranchesHint')}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {groupedBranchLinks.map((b) => (
                  <div
                    key={b.branchId}
                    className="bg-white rounded-xl border border-dark-charcoal/10 p-4 flex items-center justify-between cursor-pointer hover:bg-secondary-gray/10"
                    onClick={() => navigate(`/dashboard/branches/${b.branchId}`)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary-gold/70">{b.branchCode}</span>
                        <span className="font-bold text-dark-charcoal truncate">
                          {b.branchName}{b.branchTradeName ? ` _ ${b.branchTradeName}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {b.roles.map((r) => (
                            <span key={`${b.branchId}-${r}`} className="text-xs bg-primary-gold/10 text-primary-gold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              {ROLE_KEYS[r] ? t(ROLE_KEYS[r]) : r}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlink(b.branchId, r);
                                }}
                                className="text-alert-red hover:text-alert-red/80"
                                title={t('employers.unlinkBranch')}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        {b.ownershipPercent !== undefined && b.ownershipPercent !== null && (
                          <span className="text-xs text-dark-charcoal/60">{t('employers.share')}: {b.ownershipPercent}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const editableRole = b.roles.includes('owner') ? 'owner' : b.roles[0];
                          setEditLink({ branchId: b.branchId, branchName: b.branchName, role: editableRole, ownershipPercent: b.ownershipPercent });
                          setShowLinkModal(true);
                        }}
                        className="p-2 text-primary-gold hover:bg-primary-gold/10 rounded-lg transition"
                        title={t('employers.editRoleShare')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlink(b.branchId);
                        }}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title={t('employers.unlinkBranch')}
                      >
                        <Unlink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* تبويب المستندات — نفس شكل الأفرع: بطاقات مع أيقونة نوع الملف ومعاينة/تحميل/حذف */}
        {tab === 'docs' && (
          <div className="border border-secondary-gray rounded-lg p-6">
            <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('employers.docsTitle')}</h4>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={async () => {
                  const res = await window.electronAPI?.fileSelectDocument?.();
                  if (!res?.success) return;
                  await window.electronAPI?.documentSave?.({
                    sourceFilePath: res.filePath!,
                    relativePath: `Employers/${employer.id}`,
                    entityType: 'employer',
                    entityId: employer.id,
                  });
                  loadDocs();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-primary-gold/90 font-medium"
              >
                <Plus size={18} /> {t('employers.uploadDoc')}
              </button>
            </div>
            {docFiles.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="mx-auto text-secondary-gray mb-3" size={48} />
                <p className="text-dark-charcoal/70">{t('employers.noDocsHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {docFiles.map((doc) => {
                  const name = getDocumentDisplayName(doc.customName, doc.relativePath);
                  const ext = name.split('.').pop()?.toLowerCase();
                  const isPdf = ext === 'pdf' || isPdfDocumentName(name);
                  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '') || isImageDocumentName(name);
                  const icon = isPdf ? <FileText className="w-10 h-10 text-red-600" /> : isImg ? <ImageIcon className="w-10 h-10 text-green-600" /> : <File className="w-10 h-10 text-secondary-gray" />;
                  return (
                    <div key={doc.id} className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50">
                      {icon}
                      <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">{name}</span>
                      <div className="flex gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => handleDocPreview(doc)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('employers.preview')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDocumentExternal(doc.relativePath)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('employers.download')}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(t('employers.confirmDeleteDoc', { name }))) return;
                            await deleteDocumentById(doc.id);
                            loadDocs();
                          }}
                          className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
                          title={t('employers.deleteDoc')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* تبويب السجل */}
        {tab === 'history' && employer && (
          <HistoryTab entityType="employer" entityId={employer.id} entityName={employer.fullName} />
        )}
      </div>

      {/* أزرار الحذف والأرشفة أسفل الصفحة (مثل قسم الموظفين) */}
      <div className="mt-8 pt-6 border-t border-secondary-gray flex gap-3 justify-end">
        {canArchive && <button
          type="button"
          onClick={handleArchive}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${employer.status === 'archived' ? 'border-green-500/50 text-green-700 hover:bg-green-50' : 'border-amber-500/50 text-amber-700 hover:bg-amber-50'}`}
        >
          <Archive size={18} />
          {employer.status === 'archived' ? t('employers.restore') : t('employers.archive')}
        </button>}
        {canDelete && <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={18} />
          {t('employers.delete')}
        </button>}
      </div>

      <DocumentPreviewModal
        preview={docPreview}
        onClose={() => setDocPreview(null)}
        onOpenExternal={docPreview ? () => openDocumentExternal(docPreview.relativePath ?? '') : undefined}
      />

      {expiryPopup && (
        <UpdateExpiryPopup
          isOpen
          onClose={() => setExpiryPopup(null)}
          onSaved={() => { setExpiryPopup(null); load(); }}
          config={expiryPopup.config}
          documentConfig={expiryPopup.documentConfig}
          currentExpiry={expiryPopup.currentExpiry}
          title={expiryPopup.title}
          activityLogParams={expiryPopup.activityLogParams}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" dir={dir}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-bold text-dark-charcoal mb-2">{t('employers.confirmDeleteTitle')}</h3>
            <p className="text-sm text-dark-charcoal/60 mb-4">{t('employers.confirmDeleteMessage', { name: employer.fullName })}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm border border-dark-charcoal/15 rounded-lg">{t('employers.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">{t('employers.deletePermanent')}</button>
            </div>
          </div>
        </div>
      )}

      <LinkBranchModal
        isOpen={showLinkModal}
        onClose={() => { setShowLinkModal(false); setEditLink(null); }}
        onLinked={() => { load(); setEditLink(null); }}
        employerId={employer.id}
        alreadyLinkedBranchIds={groupedBranchLinks.map((b) => b.branchId)}
        editLink={editLink}
      />

      {showEdit && (
        <AddEmployerModal
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); load(); }}
          editEmployerId={employer.id}
        />
      )}
    </div>
  );
}
