import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import toast from 'react-hot-toast';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, form works in Edit mode */
  editEntityId?: number | null;
}


const INITIAL_FORM = {
  entityNickname: '',
  mainBranchId: '' as string,
  name: '',
  nameEn: '',
  registeredAddress: '',
  contactNumber: '',
  trn: '',
  vatEffectiveDate: '',
  vatFilingCycle: 'quarterly' as string,
  corporateTaxRegistration: '',
  corporateTaxEffectiveDate: '',
  financialYearEnd: '',
  branchIds: [] as number[],
  notes: '',
};

export default function AddEntityModal({
  isOpen,
  onClose,
  onSuccess,
  editEntityId,
}: AddEntityModalProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState(INITIAL_FORM);
  const [mainBranchOptions, setMainBranchOptions] = useState<{ id: number; name: string }[]>([]);
  const [linkableBranches, setLinkableBranches] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docUpload, setDocUpload] = useState<{ section: 'vat_cert' | 'corporate_tax_cert'; filePath: string; customName: string } | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  const validateTRN = (val: string) => {
    if (!val) return true;
    return /^\d{15}$/.test(val.replace(/\s/g, ''));
  };

  // Main branch dropdown: only branches not linked to other tax entities
  // (in edit mode, keep current entity-linked branches visible).
  useEffect(() => {
    const api = window.electronAPI;
    if (!isOpen || !api?.dbQuery) return;
    const load = async () => {
      if (editEntityId) {
        const res = await api.dbQuery(
          `SELECT b.id, b.name
           FROM branches b
           WHERE (b.status IS NULL OR b.status != 'archived')
             AND (
               b.id NOT IN (SELECT branchId FROM tax_entity_branches WHERE entityId != ?)
               OR b.id IN (SELECT branchId FROM tax_entity_branches WHERE entityId = ?)
             )
           ORDER BY b.name`,
          [editEntityId, editEntityId]
        );
        setMainBranchOptions(res?.data ?? []);
      } else {
        const res = await api.dbQuery(
          `SELECT b.id, b.name
           FROM branches b
           WHERE (b.status IS NULL OR b.status != 'archived')
             AND b.id NOT IN (SELECT branchId FROM tax_entity_branches)
           ORDER BY b.name`
        );
        setMainBranchOptions(res?.data ?? []);
      }
    };
    load();
  }, [isOpen, editEntityId]);

  // Linkable branches:
  // show only branches not linked to other tax entities.
  // In edit mode, keep branches already linked to this entity selectable.
  useEffect(() => {
    const api = window.electronAPI;
    if (!isOpen || !api?.dbQuery) return;
    const load = async () => {
      if (editEntityId) {
        const res = await api.dbQuery(
          `SELECT b.id, b.name
           FROM branches b
           WHERE (b.status IS NULL OR b.status != 'archived')
             AND (
               b.id NOT IN (SELECT branchId FROM tax_entity_branches WHERE entityId != ?)
               OR b.id IN (SELECT branchId FROM tax_entity_branches WHERE entityId = ?)
             )
           ORDER BY b.name`,
          [editEntityId, editEntityId]
        );
        setLinkableBranches(res?.data ?? []);
      } else {
        const res = await api.dbQuery(
          `SELECT b.id, b.name
           FROM branches b
           WHERE (b.status IS NULL OR b.status != 'archived')
             AND b.id NOT IN (SELECT branchId FROM tax_entity_branches)
           ORDER BY b.name`
        );
        setLinkableBranches(res?.data ?? []);
      }
    };
    load();
  }, [isOpen, editEntityId]);

  useEffect(() => {
    if (!isOpen) {
      setForm(INITIAL_FORM);
      return;
    }
    if (!editEntityId) {
      setForm(INITIAL_FORM);
      return;
    }
    const api = window.electronAPI;
    if (!api?.dbQuery) return;
    const load = async () => {
      const [entRes, linkRes] = await Promise.all([
        api.dbQuery('SELECT * FROM entities WHERE id = ?', [editEntityId]),
        api.dbQuery('SELECT branchId FROM tax_entity_branches WHERE entityId = ?', [editEntityId]),
      ]);
      const e = entRes?.data?.[0];
      if (e) {
        const linkIds = (linkRes?.data ?? []).map((r: { branchId: number }) => r.branchId);
        const mainId = e.mainBranchId != null ? e.mainBranchId : null;
        const branchIds = mainId != null && !linkIds.includes(mainId) ? [mainId, ...linkIds] : linkIds;
        const loadedForm = {
          entityNickname: e.entityNickname || '',
          mainBranchId: mainId != null ? String(mainId) : '',
          name: e.name || '',
          nameEn: e.nameEn || '',
          registeredAddress: e.registeredAddress || '',
          contactNumber: e.contactNumber || '',
          trn: e.trn || '',
          vatEffectiveDate: e.vatRegDate ? String(e.vatRegDate).slice(0, 10) : '',
          vatFilingCycle: e.vatFilingCycle || 'quarterly',
          corporateTaxRegistration: e.corporateTaxGiban || e.corporateTaxTrn || '',
          corporateTaxEffectiveDate: e.corporateTaxRegDate ? String(e.corporateTaxRegDate).slice(0, 10) : '',
          financialYearEnd: e.financialYearEnd || '',
          branchIds,
          notes: e.notes || '',
        };
        setForm(loadedForm);
        oldFormRef.current = { ...loadedForm };
      }
    };
    load();
  }, [isOpen, editEntityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.entityNickname.trim()) {
      setError(t('entities.addModal.nicknameRequired'));
      return;
    }
    if (!form.mainBranchId) {
      setError(t('entities.addModal.mainBranchRequired'));
      return;
    }
    if (form.trn && !validateTRN(form.trn)) {
      setError(t('entities.addModal.trnInvalid'));
      return;
    }

    setLoading(true);
    try {
      if (window.electronAPI?.dbQuery) {
        let logEntityId: number | undefined = editEntityId || 0;
        if (editEntityId) {
          await window.electronAPI.dbQuery(
            `UPDATE entities SET entityNickname=?, mainBranchId=?, name=?, nameEn=?, registeredAddress=?, contactNumber=?, trn=?, vatRegDate=?, vatFilingCycle=?, corporateTaxGiban=?, corporateTaxRegDate=?, financialYearEnd=?, notes=? WHERE id=?`,
            [
              form.entityNickname || null,
              form.mainBranchId ? parseInt(form.mainBranchId, 10) : null,
              form.name,
              form.nameEn || null,
              form.registeredAddress || null,
              form.contactNumber || null,
              form.trn.replace(/\s/g, '') || null,
              form.vatEffectiveDate || null,
              form.vatFilingCycle,
              form.corporateTaxRegistration || null,
              form.corporateTaxEffectiveDate || null,
              form.financialYearEnd || null,
              form.notes || null,
              editEntityId,
            ]
          );
          await window.electronAPI.dbQuery('DELETE FROM tax_entity_branches WHERE entityId = ?', [editEntityId]);
          const mainId = form.mainBranchId ? parseInt(form.mainBranchId, 10) : null;
          const idsToLink = mainId ? [...new Set([mainId, ...form.branchIds])] : form.branchIds;
          for (const bid of idsToLink) {
            await window.electronAPI.dbQuery(
              'INSERT INTO tax_entity_branches (entityId, branchId) VALUES (?, ?)',
              [editEntityId, bid]
            );
          }
        } else {
          const ins = await window.electronAPI.dbQuery(
            `INSERT INTO entities (entityNickname, mainBranchId, name, nameEn, registeredAddress, contactNumber, trn, vatRegDate, vatFilingCycle, corporateTaxGiban, corporateTaxRegDate, financialYearEnd, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              form.entityNickname || null,
              form.mainBranchId ? parseInt(form.mainBranchId, 10) : null,
              form.name,
              form.nameEn || null,
              form.registeredAddress || null,
              form.contactNumber || null,
              form.trn.replace(/\s/g, '') || null,
              form.vatEffectiveDate || null,
              form.vatFilingCycle,
              form.corporateTaxRegistration || null,
              form.corporateTaxEffectiveDate || null,
              form.financialYearEnd || null,
              form.notes || null,
            ]
          );
          const entityId = ins?.lastInsertId;
          logEntityId = entityId || 0;
          const mainId = form.mainBranchId ? parseInt(form.mainBranchId, 10) : null;
          const idsToLink = mainId ? [...new Set([mainId, ...form.branchIds])] : form.branchIds;
          if (entityId && idsToLink.length > 0) {
            for (const bid of idsToLink) {
              await window.electronAPI.dbQuery(
                'INSERT INTO tax_entity_branches (entityId, branchId) VALUES (?, ?)',
                [entityId, bid]
              );
            }
          }
        }
        const ENTITY_TRACKED = ['entityNickname', 'mainBranchId', 'name', 'nameEn', 'registeredAddress', 'contactNumber', 'trn', 'vatEffectiveDate', 'vatFilingCycle', 'corporateTaxRegistration', 'corporateTaxEffectiveDate', 'financialYearEnd', 'notes'];
        let logDetails: string;
        if (editEntityId && oldFormRef.current) {
          logDetails = buildChangeSummary(oldFormRef.current, { ...form }, 'entity', form.entityNickname || form.name, ENTITY_TRACKED);
        } else {
          logDetails = `${editEntityId ? 'edited' : 'created'}::entity::${form.entityNickname || form.name}`;
        }
        await logActivity({
          module: 'entity',
          action: editEntityId ? 'edit' : 'create',
          entityType: 'entity',
          entityId: logEntityId,
          details: logDetails,
          performedByUserId: user?.id,
          performedByUsername: user?.fullName || user?.username,
          performedByUserCode: user?.username,
        });
        onSuccess();
        setForm(INITIAL_FORM);
        onClose();
      } else {
        setError(t('entities.addModal.dbUnavailable'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entities.addModal.error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleBranch = (id: number) => {
    const mainId = form.mainBranchId ? parseInt(form.mainBranchId, 10) : 0;
    if (id === mainId) return; // الفرع الرئيسي لا يُزال
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id],
    }));
  };

  const onMainBranchChange = async (branchId: string) => {
    const mid = branchId ? parseInt(branchId, 10) : 0;
    setForm((f) => {
      const nextBranchIds = mid && !f.branchIds.includes(mid) ? [...f.branchIds, mid] : f.branchIds;
      return { ...f, mainBranchId: branchId, branchIds: nextBranchIds };
    });
    if (!branchId || !window.electronAPI?.dbQuery) return;
    const lic = await window.electronAPI.dbQuery(
      'SELECT tradeName, tradeNameEn FROM branch_licenses WHERE branchId = ? LIMIT 1',
      [mid]
    );
    const row = lic?.data?.[0];
    const branchName = mainBranchOptions.find((b) => b.id === mid)?.name ?? '';
    setForm((f) => ({
      ...f,
      mainBranchId: branchId,
      name: row?.tradeName || branchName || f.name,
      nameEn: row?.tradeNameEn ?? f.nameEn,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-lg border border-secondary-gray shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-secondary-gray">
          <h2 className="text-2xl font-bold text-primary-gold">
            {editEntityId ? t('entities.addModal.titleEdit') : t('entities.addModal.titleAdd')}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-alert-red/10 text-alert-red rounded-lg text-sm border border-alert-red/30">{error}</div>
          )}

          {/* Entity Identity */}
          <div className="space-y-4">
            <h4 className="font-semibold text-dark-charcoal border-b border-secondary-gray pb-2">
              {t('entities.addModal.entityIdentity')}
            </h4>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.entityNickname')} *
              </label>
              <input
                type="text"
                required
                placeholder={t('entities.addModal.entityNicknamePlaceholder')}
                value={form.entityNickname}
                onChange={(e) => setForm({ ...form, entityNickname: e.target.value })}
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.mainBranch')}
              </label>
              <select
                value={form.mainBranchId}
                onChange={(e) => onMainBranchChange(e.target.value)}
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
              >
                <option value="">{t('entities.addModal.chooseBranch')}</option>
                {mainBranchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {(form.name || form.nameEn) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-charcoal/70 mb-1">{t('entities.nameAr')}</label>
                  <p className="px-4 py-2 rounded-lg bg-light-background border border-secondary-gray text-dark-charcoal font-medium">
                    {form.name || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-dark-charcoal/70 mb-1">{t('entities.nameEn')}</label>
                  <p className="px-4 py-2 rounded-lg bg-light-background border border-secondary-gray text-dark-charcoal font-medium">
                    {form.nameEn || '—'}
                  </p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.registeredAddress')}
              </label>
              <textarea
                rows={2}
                value={form.registeredAddress}
                onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.contactNumber')}
              </label>
              <input
                type="text"
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
              />
            </div>
          </div>

          {/* VAT Section (5%) */}
          <div className="space-y-4">
            <h4 className="font-semibold text-dark-charcoal border-b border-secondary-gray/50 pb-2">
              {t('entities.addModal.vatSection')}
            </h4>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.trnLabel')}
              </label>
              <input
                type="text"
                maxLength={17}
                placeholder={t('entities.addModal.trnPlaceholder')}
                value={form.trn}
                onChange={(e) =>
                  setForm({ ...form, trn: e.target.value.replace(/\D/g, '').slice(0, 15) })
                }
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-gold bg-white ${
                  form.trn && !validateTRN(form.trn) ? 'border-alert-red' : 'border-secondary-gray'
                }`}
              />
              {form.trn && !validateTRN(form.trn) && (
                <p className="text-xs text-alert-red mt-1">{t('entities.addModal.trnError')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('entities.addModal.regDate')}
                </label>
                <DatePicker value={form.vatEffectiveDate} onChange={(v) => setForm({ ...form, vatEffectiveDate: v })} placeholder={t('entities.chooseDate')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('entities.addModal.filingCycle')}
                </label>
                <select
                  value={form.vatFilingCycle}
                  onChange={(e) => setForm({ ...form, vatFilingCycle: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
                >
                  <option value="quarterly">{t('entities.vatCycles.quarterly')}</option>
                  <option value="monthly">{t('entities.vatCycles.monthly')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Corporate Tax Section (9%) */}
          <div className="space-y-4">
            <h4 className="font-semibold text-dark-charcoal border-b border-secondary-gray/50 pb-2">
              {t('entities.addModal.corporateSection')}
            </h4>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">
                {t('entities.addModal.corporateRegNo')}
              </label>
              <input
                type="text"
                value={form.corporateTaxRegistration}
                onChange={(e) =>
                  setForm({ ...form, corporateTaxRegistration: e.target.value })
                }
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('entities.addModal.regDate')}
                </label>
                <DatePicker value={form.corporateTaxEffectiveDate} onChange={(v) => setForm({ ...form, corporateTaxEffectiveDate: v })} placeholder={t('entities.chooseDate')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('entities.addModal.financialYearEnd')}
                </label>
                <select
                  value={form.financialYearEnd}
                  onChange={(e) => setForm({ ...form, financialYearEnd: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
                >
                  <option value="">—</option>
                  <option value="03-31">{t('entities.fyeMonths.03-31')}</option>
                  <option value="06-30">{t('entities.fyeMonths.06-30')}</option>
                  <option value="09-30">{t('entities.fyeMonths.09-30')}</option>
                  <option value="12-31">{t('entities.fyeMonths.12-31')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Branch Linking */}
          <div className="space-y-4">
            <h4 className="font-semibold text-dark-charcoal border-b border-secondary-gray/50 pb-2">
              {t('entities.addModal.linkBranches')}
            </h4>
            <p className="text-sm text-dark-charcoal/70">
              {t('entities.addModal.linkBranchesHint')}
            </p>
            <p className="text-sm text-dark-charcoal/70">{t('entities.addModal.linkBranchesHint2')}</p>
            {(() => {
              const mainId = form.mainBranchId ? parseInt(form.mainBranchId, 10) : 0;
              const mainBranch = mainId ? mainBranchOptions.find((b) => b.id === mainId) : null;
              const list = mainBranch && !linkableBranches.some((b) => b.id === mainId)
                ? [mainBranch, ...linkableBranches]
                : linkableBranches;
              if (list.length === 0) return <p className="text-sm text-secondary-gray">{t('entities.addModal.noBranchesToLink')}</p>;
              return (
                <div className="max-h-40 overflow-y-auto border border-secondary-gray rounded-lg p-3 space-y-2 bg-white">
                  {list.map((b) => {
                    const isMain = mainId !== 0 && b.id === mainId;
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 rounded px-2 py-1 ${isMain ? 'cursor-default bg-secondary-gray/20 opacity-90' : 'cursor-pointer hover:bg-secondary-gray/10'}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.branchIds.includes(b.id)}
                          onChange={() => toggleBranch(b.id)}
                          disabled={isMain}
                        />
                        <span className={isMain ? 'text-dark-charcoal/80' : ''}>{b.name}</span>
                        {isMain && <span className="text-xs text-primary-gold font-medium">{t('entities.mainBranch')}</span>}
                      </label>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {editEntityId && (
            <div className="space-y-4">
              <h4 className="font-semibold text-dark-charcoal border-b border-secondary-gray/50 pb-2">
                {t('entities.addModal.taxDocuments')}
              </h4>
              <p className="text-sm text-dark-charcoal/70">{t('entities.addModal.taxDocumentsHint')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.electronAPI?.fileSelectDocument?.();
                    if (res?.success && res?.filePath) setDocUpload({ section: 'vat_cert', filePath: res.filePath, customName: '' });
                    else if (!res?.canceled) toast.error(res?.error || t('entities.addModal.fileSelectFailed'));
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm font-medium"
                >
                  <Upload size={16} /> {t('entities.addModal.addDocVat')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.electronAPI?.fileSelectDocument?.();
                    if (res?.success && res?.filePath) setDocUpload({ section: 'corporate_tax_cert', filePath: res.filePath, customName: '' });
                    else if (!res?.canceled) toast.error(res?.error || t('entities.addModal.fileSelectFailed'));
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm font-medium"
                >
                  <Upload size={16} /> {t('entities.addModal.addDocCorporate')}
                </button>
              </div>
              {docUpload && (
                <div className="p-3 border border-primary-gold/30 rounded-lg bg-primary-gold/5 space-y-2">
                  <p className="text-sm font-medium text-dark-charcoal">
                    {docUpload.section === 'vat_cert' ? t('entities.addModal.vatOrCorporate') : t('entities.addModal.corporateTax')} — {t('entities.addModal.docNameOptional')}:
                  </p>
                  <input
                    type="text"
                    value={docUpload.customName}
                    onChange={(e) => setDocUpload((d) => d ? { ...d, customName: e.target.value } : null)}
                    placeholder={t('entities.addModal.docNamePlaceholder')}
                    className="w-full max-w-xs px-3 py-2 border border-secondary-gray rounded-lg bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={docUploading}
                      onClick={async () => {
                        if (!docUpload || !window.electronAPI?.documentSave) return;
                        setDocUploading(true);
                        const parts = docUpload.filePath.replace(/\\/g, '/').split('/');
                        const baseName = parts[parts.length - 1] || 'file';
                        const ext = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : '';
                        const targetName = docUpload.customName.trim() ? docUpload.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext : baseName;
                        const relativePath = `Taxes/${editEntityId}/${docUpload.section}/${targetName}`;
                        const res = await window.electronAPI.documentSave({
                          sourceFilePath: docUpload.filePath,
                          relativePath,
                          customName: docUpload.customName.trim() || baseName,
                          entityType: 'entity',
                          entityId: editEntityId,
                          section: docUpload.section,
                        });
                        setDocUploading(false);
                        if (res?.success) {
                          toast.success(t('entities.addModal.uploadSuccess'));
                          setDocUpload(null);
                        } else toast.error(res?.error || t('entities.addModal.uploadFailed'));
                      }}
                      className="px-4 py-2 rounded-lg bg-primary-gold text-white disabled:opacity-50 text-sm"
                    >
                      {docUploading ? t('entities.addModal.uploading') : t('entities.addModal.upload')}
                    </button>
                    <button type="button" onClick={() => setDocUpload(null)} className="px-4 py-2 rounded-lg border border-secondary-gray text-sm">{t('entities.cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.addModal.notes')}</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-gold text-white py-2 px-4 rounded-lg hover:bg-accent-sand disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? t('entities.addModal.saving') : editEntityId ? t('entities.saveEdits') : t('entities.addModal.saveEntity')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-secondary-gray rounded-lg hover:bg-secondary-gray/20 transition-colors"
            >
              {t('entities.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
