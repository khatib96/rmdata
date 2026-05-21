import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Store, User, Building2, FolderOpen, History, Info, Archive, Trash2 } from 'lucide-react';
import HistoryTab from '../shared/HistoryTab';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import AddPhoneModal from './AddPhoneModal';
import { PHONE_ICON_MAP } from '../Icons/PhoneIcons';
import { getDocumentDisplayName } from '../../utils/documentHelpers';
import { getActiveBranchesForPhoneAssignments, getActiveLegalEntityBranchOptions } from '../../services/branchService';
import { getAssignableEmployeesForPhones } from '../../services/employeeService';
import { getAssignableEmployersForPhones } from '../../services/employerService';
import { getActiveHousingForPhoneAssignments } from '../../services/housingService';
import { listDocuments, deleteDocumentById } from '../../services/documentService';
import type { DocumentListItem } from '../../types/documents';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';

type TabId = 'basic' | 'history' | 'documents';

interface PhoneDetails {
  id: number;
  code?: string;
  phoneNumber?: string;
  provider?: string;
  category?: string;
  numberType?: string;
  billAmount?: number;
  registeredName?: string;
  legalEntityId?: number;
  legalEntityName?: string;
  assignedBranchId?: number;
  assignedEmployeeId?: number;
  assignedEmployerId?: number;
  assignedHousingId?: number;
  note?: string;
  status?: string;
  assignedBranchName?: string;
  assignedEmployeeName?: string;
  assignedEmployerName?: string;
  assignedHousingName?: string;
  assignedBranchImage?: string;
  assignedEmployeeImage?: string;
  assignedBranchCode?: string;
  assignedEmployeeCode?: string;
  assignedEmployerCode?: string;
  assignedHousingCode?: string;
}

export default function PhoneProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = useMemo(() => can('phones', 'edit'), [can]);
  const canDelete = useMemo(() => can('phones', 'delete'), [can]);
  const canArchive = canEdit;
  const ALL_TABS: { id: TabId; label: string; icon: typeof Info }[] = [
    { id: 'basic', label: t('phones.tabBasic'), icon: Info },
    { id: 'history', label: t('phones.tabHistory'), icon: History },
    { id: 'documents', label: t('phones.tabDocuments'), icon: FolderOpen },
  ];
  const TABS = useMemo(() => ALL_TABS.filter((tab) => can('phones', `tab.${tab.id}`)), [can]);
  const phoneId = id ? parseInt(id, 10) : NaN;

  const [phone, setPhone] = useState<PhoneDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [phoneDocuments, setPhoneDocuments] = useState<DocumentListItem[]>([]);

  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [employers, setEmployers] = useState<{ id: number; name: string }[]>([]);
  const [housings, setHousings] = useState<{ id: number; name: string }[]>([]);
  const [legalEntities, setLegalEntities] = useState<{ id: number; name: string }[]>([]);

  const loadData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    const branchesRes = await getActiveBranchesForPhoneAssignments();
    if (branchesRes?.success && Array.isArray(branchesRes.data)) setBranches(branchesRes.data as { id: number; name: string }[]);

    const empsRes = await getAssignableEmployeesForPhones();
    if (empsRes?.success && Array.isArray(empsRes.data)) setEmployees(empsRes.data as { id: number; name: string }[]);

    const empOwnersRes = await getAssignableEmployersForPhones();
    if (empOwnersRes?.success && Array.isArray(empOwnersRes.data)) setEmployers(empOwnersRes.data as { id: number; name: string }[]);

    const housingRes = await getActiveHousingForPhoneAssignments();
    if (housingRes?.success && Array.isArray(housingRes.data)) setHousings(housingRes.data as { id: number; name: string }[]);
    
    const entitiesRes = await getActiveLegalEntityBranchOptions();
    if (entitiesRes?.success && Array.isArray(entitiesRes.data)) setLegalEntities(entitiesRes.data as { id: number; name: string }[]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadPhoneDetails = async () => {
    if (!window.electronAPI?.dbQuery || isNaN(phoneId)) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.dbQuery(
        `SELECT p.*, p.code,
         b.name as assignedBranchName, b.photoPath as assignedBranchImage, b.code as assignedBranchCode,
         e.name as assignedEmployeeName, e.imagePath as assignedEmployeeImage, e.code as assignedEmployeeCode,
         o.fullName as assignedEmployerName, o.code as assignedEmployerCode,
         h.name as assignedHousingName, h.code as assignedHousingCode,
         COALESCE(bl.tradeName, ent_b.name) as legalEntityName
         FROM phones p
         LEFT JOIN branches b ON p.assignedBranchId = b.id
         LEFT JOIN employees e ON p.assignedEmployeeId = e.id
         LEFT JOIN employers o ON p.assignedEmployerId = o.id
         LEFT JOIN housing_units h ON p.assignedHousingId = h.id
         LEFT JOIN branches ent_b ON p.legalEntityId = ent_b.id
         LEFT JOIN branch_licenses bl ON ent_b.id = bl.branchId
         WHERE p.id = ?`,
        [phoneId]
      );
      
      const pData = result?.data?.[0] as PhoneDetails | undefined;
      if (!pData) {
        setPhone(null);
        setLoading(false);
        return;
      }
      setPhone(pData);

      // Load Documents
      const docRes = await listDocuments('phone', phoneId);
      setPhoneDocuments(docRes?.success && Array.isArray(docRes.data) ? docRes.data : []);

    } catch (e) {
      console.error(e);
      setPhone(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phoneId) loadPhoneDetails();
  }, [phoneId]);

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const performerLabel = user ? `${user.fullName || user.username}${user.entityId != null ? ` (${user.entityId})` : ''}` : t('phones.systemPerformer');

  const handleArchive = async () => {
    if (!window.electronAPI?.archiveRecord && !window.electronAPI?.dbQuery) return;
    try {
      if (window.electronAPI.archiveRecord) {
        const res = await window.electronAPI.archiveRecord(sessionToken, 'phones', phoneId);
        if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      } else if (window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery('UPDATE phones SET status = ? WHERE id = ?', ['archived', phoneId]);
      }
      const label = phone?.phoneNumber || phone?.code || `phone ${phoneId}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'phone',
        entityId: phoneId,
        details: `archived::phone::${label}::${performerLabel}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      setArchiveConfirm(false);
      navigate('/dashboard/phones');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      for (const doc of phoneDocuments) {
        await deleteDocumentById(doc.id);
      }
      await window.electronAPI.dbQuery('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['phone', phoneId]);
      await window.electronAPI.dbQuery('DELETE FROM phones WHERE id = ?', [phoneId]);
      setDeleteConfirm(false);
      navigate('/dashboard/phones');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary-gray">{t('phones.loadingPhone')}</p>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-alert-red font-medium">{t('phones.phoneNotFound')}</p>
        <button
          onClick={() => navigate('/dashboard/phones')}
          className="text-primary-gold hover:underline flex items-center gap-2"
        >
          <ChevronLeft size={16} className="rotate-180" /> {t('phones.back')}
        </button>
      </div>
    );
  }

  const IconComponent = PHONE_ICON_MAP[phone.numberType as keyof typeof PHONE_ICON_MAP] || PHONE_ICON_MAP['mobile'];

  const EntityLink = ({ id, type, name, path, code }: { id: number, type: 'branch'|'employee'|'employer'|'housing', name: string, path?: string, code?: string }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    useEffect(() => {
      const api = window.electronAPI as any;
      if (path && api?.fileGetImageUrl) {
        api.fileGetImageUrl(path).then((res: any) => {
          if (res?.success && res.url) setImgUrl(res.url);
        });
      }
    }, [path]);

    const route = type === 'branch' ? `/dashboard/branches/${id}` : type === 'employee' ? `/dashboard/employees/${id}` : type === 'employer' ? `/dashboard/employers/${id}` : `/dashboard/housing/${id}`;
    const DefaultIcon = type === 'employee' || type === 'employer' ? User : type === 'branch' ? Store : Building2;

    return (
      <button 
        onClick={() => navigate(route)}
        className="inline-flex items-center gap-2 bg-secondary-gray/10 text-dark-charcoal font-bold px-4 py-2 rounded-lg hover:bg-primary-gold/10 hover:text-primary-gold transition-colors"
      >
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="w-6 h-6 rounded-full object-cover shrink-0 block border border-white shadow-sm" />
        ) : (
          <DefaultIcon size={20} className="shrink-0" />
        )}
        {name} {code && <span className="font-mono text-sm text-dark-charcoal/70">({code})</span>}
      </button>
    );
  };

  return (
    <div className="animate-in fade-in duration-200">
      {/* Top bar: Back arrow only (top right) */}
      <div className="flex justify-start mb-2">
        <button
          onClick={() => navigate('/dashboard/phones')}
          className="p-2 rounded-lg text-dark-charcoal hover:text-primary-gold hover:bg-primary-gold/10 transition-colors"
          aria-label="رجوع"
        >
          <ChevronLeft size={24} className="rotate-180" />
        </button>
      </div>

      {/* بطاقة الهاتف: أيقونة على اليمين ورقم بالنص نفس طريقة الأفرع */}
      <div className="relative flex flex-row items-center justify-between gap-6 mb-6">
        <div className="shrink-0 pt-4 w-24 flex justify-center">
          <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0">
            <IconComponent size={64} className="text-primary-gold drop-shadow-sm" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 pt-4">
          <h1 className="text-3xl md:text-4xl font-bold text-dark-charcoal tracking-wider" dir="ltr">{phone.phoneNumber || t('phones.noNumber')}</h1>
          {phone.code && <p className="text-sm font-mono text-dark-charcoal/60 mt-1" dir="ltr">{phone.code}</p>}
        </div>
        <div className="shrink-0 w-24"></div>
      </div>

      {/* Horizontal separator */}
      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      {/* أزرار التعديل فوق التبويبات (مثل أصحاب العمل) — عربي: يسار، إنجليزي: يمين */}
      <div className="shrink-0 flex items-center justify-end gap-2 mb-4">
        {canEdit && <button
          onClick={() => setEditModalOpen(true)}
          className="shrink-0 flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium transition-colors"
        >
          {t('phones.editData')}
        </button>}
      </div>

      {/* التبويبات */}
      <TabsOrDropdown
        tabs={TABS as any}
        activeTab={activeTab}
        onTabChange={(id: string) => setActiveTab(id as TabId)}
      />

      <div className="bg-white rounded-lg border border-secondary-gray p-6 min-h-[400px]">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-right">
              <div>
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.provider')}</p>
                <p className="font-medium text-dark-charcoal">{phone.provider === 'etisalat' ? t('phones.providerEtisalat') : phone.provider === 'du' ? t('phones.providerDu') : phone.provider || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.lineType')}</p>
                <p className="font-medium text-dark-charcoal">{phone.numberType === 'landline' ? t('phones.landline') : t('phones.mobile')}</p>
              </div>
              <div>
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.paymentCategory')}</p>
                <p className="font-medium text-dark-charcoal">{phone.category === 'prepaid' ? t('phones.categoryPrepaid') : t('phones.categoryPostpaid')}</p>
              </div>
              
              {phone.category === 'postpaid' && phone.billAmount != null && (
                <div>
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.expectedBillAed')}</p>
                  <p className="font-medium text-dark-charcoal">{phone.billAmount != null ? phone.billAmount.toLocaleString('en') : '—'}</p>
                </div>
              )}
              
              {phone.category === 'postpaid' && (
                <div className="md:col-span-2">
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.registeredAs')}</p>
                  <p className="font-medium text-dark-charcoal">{phone.legalEntityName || '—'}</p>
                </div>
              )}
              
              {phone.category === 'prepaid' && (
                <div className="md:col-span-2">
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.registeredNamePrepaid')}</p>
                  <p className="font-medium text-dark-charcoal">{phone.registeredName || '—'}</p>
                </div>
              )}

              {(phone.assignedEmployeeId || phone.assignedEmployerId || phone.assignedBranchId || phone.assignedHousingId) && (
                <div className="md:col-span-4 pt-4 border-t border-secondary-gray/30">
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('phones.currentAssignment')}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {phone.assignedEmployeeId ? (
                      <EntityLink id={phone.assignedEmployeeId} type="employee" name={phone.assignedEmployeeName!} path={phone.assignedEmployeeImage} code={phone.assignedEmployeeCode} />
                    ) : phone.assignedEmployerId ? (
                      <EntityLink id={phone.assignedEmployerId} type="employer" name={phone.assignedEmployerName!} code={phone.assignedEmployerCode} />
                    ) : phone.assignedBranchId ? (
                      <EntityLink id={phone.assignedBranchId} type="branch" name={phone.assignedBranchName!} path={phone.assignedBranchImage} code={phone.assignedBranchCode} />
                    ) : phone.assignedHousingId ? (
                      <EntityLink id={phone.assignedHousingId} type="housing" name={phone.assignedHousingName!} code={phone.assignedHousingCode} />
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {phone.note && (
              <div className="pt-4 border-t border-secondary-gray/30">
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-1">{t('phones.notes')}</p>
                <p className="text-dark-charcoal whitespace-pre-wrap">{phone.note}</p>
              </div>
            )}
          </div>
        )}

          {activeTab === 'documents' && (
            <div>
              {              phoneDocuments.length === 0 ? (
                <p className="text-secondary-gray text-center py-8">{t('phones.noDocuments')}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {phoneDocuments.map((doc) => (
                    <div key={doc.id} className="border border-secondary-gray/30 p-4 rounded-lg flex items-center justify-between hover:border-primary-gold/50 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FolderOpen size={20} className="text-primary-gold shrink-0" />
                        <span className="truncate text-sm text-dark-charcoal font-medium">
                          {getDocumentDisplayName(doc.customName, doc.relativePath)}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          const api = window.electronAPI as any;
                          const result = await api?.documentOpen?.(doc.id);
                          if (!result?.success) {
                            alert(t('phones.openDocFailed') + ': ' + (result?.error || ''));
                          }
                        }}
                        className="text-xs px-3 py-1 bg-secondary-gray/10 rounded-md hover:bg-secondary-gray/20 text-dark-charcoal whitespace-nowrap"
                      >
                        {t('phones.open')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="phone" entityId={phoneId} />
          )}
        </div>

      <div className="mt-8 pt-6 border-t border-secondary-gray flex gap-3 justify-end">
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

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setArchiveConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <Archive size={28} />
              <h3 className="font-bold text-lg">{t('phones.confirmArchive')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('phones.confirmArchiveMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setArchiveConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button type="button" onClick={handleArchive} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('common.archive')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 size={28} />
              <h3 className="font-bold text-lg">{t('phones.confirmDelete')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('phones.confirmDeleteMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <AddPhoneModal
          editPhoneId={phoneId}
          onClose={() => setEditModalOpen(false)}
          onSuccess={loadPhoneDetails}
          branches={branches}
          employees={employees}
          employers={employers}
          housings={housings}
          legalEntities={legalEntities}
        />
      )}
    </div>
  );
}
