import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Archive, Trash2 } from 'lucide-react';
import HistoryTab from '../shared/HistoryTab';
import AddEntityModal from './AddEntityModal';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import DocumentPreviewModal from '../shared/DocumentPreviewModal';
import TaxIcon from '../Icons/TaxIcon';
import { ConfirmModal } from '../shared/ConfirmModal';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';
import type { DocumentListItem, DocumentPreview } from '../../types/documents';
import { dbQuery, invalidateDbCache } from '../../services/dbClient';
import { getTabs, type TabId, type EntityDetails, type LinkedBranch, type TaxPayment } from './entityProfile/entityProfileTypes';
import { EntityProfileDocumentsTab } from './entityProfile/EntityProfileDocumentsTab';
import { VatPaymentsTab, CorporatePaymentsTab, TaxSummaryTab } from './entityProfile/EntityProfileTaxTabs';

export default function EntityProfile() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = useMemo(() => can('entities', 'edit'), [can]);
  const canDelete = useMemo(() => can('entities', 'delete'), [can]);
  const canArchive = canEdit;
  const ALL_TABS = getTabs(t);
  const TABS = useMemo(() => ALL_TABS.filter((tab) => can('entities', `tab.${tab.id}`)), [can]);
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const entityId = id ? parseInt(id, 10) : NaN;

  const [entity, setEntity] = useState<EntityDetails | null>(null);
  const [linkedBranches, setLinkedBranches] = useState<LinkedBranch[]>([]);
  const [vatPayments, setVatPayments] = useState<TaxPayment[]>([]);
  const [corporatePayments, setCorporatePayments] = useState<TaxPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [entityDocs, setEntityDocs] = useState<DocumentListItem[]>([]);
  const [docPreview, setDocPreview] = useState<DocumentPreview | null>(null);

  const loadProfile = async () => {
    if (isNaN(entityId)) return;
    setLoading(true);
    try {
      const entRes = await dbQuery('SELECT * FROM entities WHERE id = ?', [entityId], {
        skipCache: true,
      });
      const e = (entRes?.data as EntityDetails[] | undefined)?.[0];
      if (!e) {
        setEntity(null);
        setLoading(false);
        return;
      }
      setEntity({
        ...e,
        vatRegDate: e.vatRegDate ? String(e.vatRegDate).slice(0, 10) : undefined,
        corporateTaxRegDate: e.corporateTaxRegDate ? String(e.corporateTaxRegDate).slice(0, 10) : undefined,
      });

      const docRes = await window.electronAPI?.documentList?.('entity', entityId, undefined);
      const allDocs = docRes?.success && Array.isArray(docRes.data) ? (docRes.data as DocumentListItem[]) : [];
      setEntityDocs(allDocs.filter((d) => d.section === 'vat_cert' || d.section === 'corporate_tax_cert'));

      const mainBranchId = e.mainBranchId != null ? e.mainBranchId : null;
      const linkRes = await dbQuery(
        'SELECT branchId FROM tax_entity_branches WHERE entityId = ?',
        [entityId],
        { skipCache: true }
      );
      const branchRows = (linkRes?.data as { branchId: number }[] | undefined) ?? [];
      const branchIds = branchRows.map((r) => r.branchId);
      const allBranchIds =
        mainBranchId != null ? [mainBranchId, ...branchIds.filter((bid: number) => bid !== mainBranchId)] : branchIds;

      const branchesList: LinkedBranch[] = [];
      for (const bid of allBranchIds) {
        const [bRes, licRes] = await Promise.all([
          dbQuery('SELECT id, name FROM branches WHERE id = ?', [bid], { skipCache: true }),
          dbQuery(
            'SELECT tradeName, tradeNameEn, licenseNo FROM branch_licenses WHERE branchId = ? LIMIT 1',
            [bid],
            { skipCache: true }
          ),
        ]);
        const b = (bRes?.data as { id: number; name: string }[] | undefined)?.[0];
        const lic = (licRes?.data as
          | { tradeName?: string; tradeNameEn?: string; licenseNo?: string }[]
          | undefined)?.[0];
        if (b) {
          branchesList.push({
            branchId: b.id,
            branchName: b.name,
            tradeName: lic?.tradeName,
            tradeNameEn: lic?.tradeNameEn,
            licenseNo: lic?.licenseNo,
            isMain: bid === mainBranchId,
          });
        }
      }
      setLinkedBranches(branchesList);

      const payRes = await dbQuery(
        'SELECT * FROM tax_payments WHERE entityId = ? ORDER BY financialYear DESC, quarter DESC, paymentDate DESC',
        [entityId],
        { skipCache: true }
      );
      const allPayments = (payRes?.data as TaxPayment[] | undefined) ?? [];
      setVatPayments(allPayments.filter((p) => p.type === 'vat'));
      setCorporatePayments(allPayments.filter((p) => p.type === 'corporate'));
    } catch (err) {
      console.error(err);
      setEntity(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) loadProfile();
  }, [entityId]);

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const performerLabel = user
    ? `${user.fullName || user.username}${user.entityId != null ? ` (${user.entityId})` : ''}`
    : t('entities.system');

  const handleArchive = async () => {
    try {
      if (window.electronAPI?.archiveRecord) {
        const res = await window.electronAPI.archiveRecord(sessionToken, 'entities', entityId);
        if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      } else {
        await dbQuery('UPDATE entities SET status = ? WHERE id = ?', ['archived', entityId], { skipCache: true });
      }
      const label = entity?.entityNickname || entity?.name || `كيان ${entityId}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'entity',
        entityId: entityId,
        details: `archived::entity::${label}::${performerLabel}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      setArchiveConfirm(false);
      invalidateDbCache();
      navigate('/dashboard/entities');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    try {
      if (window.electronAPI?.archiveDeletePermanent) {
        const res = await window.electronAPI.archiveDeletePermanent(sessionToken, 'entities', entityId);
        if (!res?.success) throw new Error(res?.error || 'DELETE_FAILED');
      } else {
        await dbQuery('DELETE FROM tax_payments WHERE entityId = ?', [entityId], { skipCache: true });
        await dbQuery('DELETE FROM tax_entity_branches WHERE entityId = ?', [entityId], { skipCache: true });
        await dbQuery('DELETE FROM entities WHERE id = ?', [entityId], { skipCache: true });
      }
      setDeleteConfirm(false);
      invalidateDbCache();
      navigate('/dashboard/entities');
    } catch (e) {
      console.error(e);
    }
  };

  if (isNaN(entityId)) {
    navigate('/dashboard/entities');
    return null;
  }

  if (loading) {
    return <div className="p-12 text-center text-secondary-gray">{t('entities.loading')}</div>;
  }

  if (!entity) {
    return (
      <div className="p-12 text-center">
        <p className="text-alert-red mb-4">{t('entities.loadFailed')}</p>
        <button type="button" onClick={() => navigate('/dashboard/entities')} className="text-primary-gold hover:underline">
          {t('entities.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-200" dir={dir}>
      <div className={`flex mb-2 ${dir === 'rtl' ? 'justify-start' : 'justify-end'}`}>
        <button
          type="button"
          onClick={() => navigate('/dashboard/entities')}
          className="p-2 rounded-lg text-dark-charcoal hover:text-primary-gold hover:bg-primary-gold/10 transition-colors"
          aria-label="رجوع"
        >
          <ArrowRight size={24} />
        </button>
      </div>

      <div className="flex flex-row items-center justify-between gap-6 mb-6">
        <div className="shrink-0 flex items-center justify-center">
          <TaxIcon size={48} className="text-primary-gold" golden />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">
            {entity.entityNickname || entity.name || '—'}
          </h1>
        </div>
        <div className="shrink-0" />
      </div>

      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      <div className={`shrink-0 flex items-center gap-2 mb-4 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
        {canEdit && <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
        >
          {t('entities.edit')}
        </button>}
      </div>

      <TabsOrDropdown tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

      <div className="bg-white rounded-lg border border-secondary-gray p-6">
        {activeTab === 'main' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('entities.nameAr')}</label>
              <p className="font-medium text-dark-charcoal">{entity.name || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('entities.nameEn')}</label>
              <p className="font-medium text-dark-charcoal">{entity.nameEn || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-charcoal/70">TRN</label>
              <p className="font-medium text-dark-charcoal">{entity.trn || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('entities.trnRegDate')}</label>
              <p className="font-medium">{entity.vatRegDate || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-charcoal/70">CTRN</label>
              <p className="font-medium">{entity.corporateTaxGiban || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('entities.ctrnRegDate')}</label>
              <p className="font-medium">{entity.corporateTaxRegDate || '—'}</p>
            </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-secondary-gray/20">
                <tr>
                  <th className="p-3 text-dark-charcoal font-medium">{t('entities.branch')}</th>
                  <th className="p-3 text-dark-charcoal font-medium">{t('entities.tradeName')}</th>
                  <th className="p-3 text-dark-charcoal font-medium">{t('entities.licenseNo')}</th>
                  <th className="p-3 text-dark-charcoal font-medium">{t('entities.type')}</th>
                </tr>
              </thead>
              <tbody>
                {linkedBranches.map((b) => (
                  <tr key={b.branchId} className="border-t border-secondary-gray/50">
                    <td className="p-3 font-medium">{b.branchName}</td>
                    <td className="p-3 text-dark-charcoal/80">{b.tradeName || b.tradeNameEn || '—'}</td>
                    <td className="p-3 text-dark-charcoal/80">{b.licenseNo || '—'}</td>
                    <td className="p-3">
                      {b.isMain ? <span className="text-primary-gold font-medium">{t('entities.mainBranch')}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linkedBranches.length === 0 && <p className="text-secondary-gray py-4">{t('entities.noLinkedBranches')}</p>}
          </div>
        )}

        {activeTab === 'vat' && (
          <VatPaymentsTab entityId={entityId} payments={vatPayments} onSaved={loadProfile} t={t} />
        )}

        {activeTab === 'corporate' && (
          <CorporatePaymentsTab entityId={entityId} payments={corporatePayments} onSaved={loadProfile} t={t} />
        )}

        {activeTab === 'summary' && (
          <TaxSummaryTab vatPayments={vatPayments} corporatePayments={corporatePayments} t={t} />
        )}

        {activeTab === 'documents' && (
          <EntityProfileDocumentsTab
            entityId={entityId}
            documents={entityDocs}
            onSaved={loadProfile}
            onPreview={setDocPreview}
            t={t}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab entityType="entity" entityId={entityId} entityName={entity.entityNickname || entity.name} />
        )}
      </div>

      <DocumentPreviewModal
        preview={docPreview}
        onClose={() => setDocPreview(null)}
        onOpenExternal={async (relativePath) => {
          if (relativePath) await window.electronAPI?.documentOpenExternal?.(relativePath);
        }}
      />

      <div className={`mt-8 pt-6 border-t border-secondary-gray flex gap-3 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
        {canArchive && <button
          type="button"
          onClick={() => setArchiveConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 text-amber-700 hover:bg-amber-50 transition-colors"
        >
          <Archive size={18} />
          {t('entities.archive')}
        </button>}
        {canDelete && <button
          type="button"
          onClick={() => setDeleteConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={18} />
          {t('entities.delete')}
        </button>}
      </div>

      <ConfirmModal
        open={archiveConfirm}
        variant="archive"
        title={t('entities.confirmArchive')}
        message={t('entities.confirmArchiveMessage')}
        cancelLabel={t('entities.cancel')}
        confirmLabel={t('entities.archive')}
        onCancel={() => setArchiveConfirm(false)}
        onConfirm={handleArchive}
        dir={dir}
      />
      <ConfirmModal
        open={deleteConfirm}
        variant="delete"
        title={t('entities.confirmDelete')}
        message={t('entities.confirmDeleteMessage')}
        cancelLabel={t('entities.cancel')}
        confirmLabel={t('entities.delete')}
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        dir={dir}
      />

      <AddEntityModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
          loadProfile();
        }}
        editEntityId={entityId}
      />
    </div>
  );
}
