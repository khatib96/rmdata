import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Building2, Loader2, Save } from 'lucide-react';
import { getMainBranchesForEmployerLink } from '../../services/branchService';
import toast from 'react-hot-toast';

interface BranchOption {
  id: number;
  name: string;
  code?: string;
  tradeName?: string;
  emirate?: string;
  branchType?: string;
}

export interface EditLinkValue {
  branchId: number;
  branchName: string;
  role: string;
  ownershipPercent?: number | null;
}

interface LinkBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
  employerId: number;
  alreadyLinkedBranchIds: number[];
  /** عند التعديل: الفرع والدور والحصة الحالية */
  editLink?: EditLinkValue | null;
}

type BranchRoleStat = {
  branchId: number;
  hasOwner: number;
  hasPartner: number;
};

export default function LinkBranchModal({
  isOpen,
  onClose,
  onLinked,
  employerId,
  alreadyLinkedBranchIds,
  editLink,
}: LinkBranchModalProps) {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState<string>('');
  const [role, setRole] = useState<string>('owner');
  const [ownershipPercent, setOwnershipPercent] = useState<string>('');
  const [branchRoleStats, setBranchRoleStats] = useState<BranchRoleStat[]>([]);

  const isEditMode = Boolean(editLink?.branchId);
  const ROLE_OPTIONS = useMemo(() => [
    { value: 'owner', label: t('employers.roleOwner') },
    { value: 'partner', label: t('employers.rolePartner') },
    { value: 'manager', label: t('employers.roleManager') },
    { value: 'agent', label: t('employers.roleAgent') },
  ], [t]);

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    if (editLink) {
      setBranchId(String(editLink.branchId));
      setRole(editLink.role || 'owner');
      setOwnershipPercent(editLink.ownershipPercent != null ? String(editLink.ownershipPercent) : '');
    } else {
      setBranchId('');
      setRole('owner');
      setOwnershipPercent('');
    }
    setLoading(true);
    getMainBranchesForEmployerLink()
      .then((res) => {
        const rows = (res?.data ?? res) as BranchOption[];
        setBranches(Array.isArray(rows) ? rows : []);
      })
      .finally(() => setLoading(false));

    window.electronAPI.dbQuery(
      `SELECT branchId,
              MAX(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) as hasOwner,
              MAX(CASE WHEN role = 'partner' THEN 1 ELSE 0 END) as hasPartner
       FROM branch_employers
       GROUP BY branchId`
    ).then((res) => {
      setBranchRoleStats((res?.data ?? []) as BranchRoleStat[]);
    });
  }, [isOpen, editLink]);

  useEffect(() => {
    if (role === 'owner') setOwnershipPercent('100');
    else if (role === 'manager' || role === 'agent') setOwnershipPercent('0');
    else if (ownershipPercent === '100' || ownershipPercent === '0') setOwnershipPercent('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Order: unlinked first, then linked.
  const orderedBranches = [...branches].sort((a, b) => {
    const aLinked = alreadyLinkedBranchIds.includes(a.id) ? 1 : 0;
    const bLinked = alreadyLinkedBranchIds.includes(b.id) ? 1 : 0;
    return aLinked - bLinked;
  });

  const availableBranches = orderedBranches.filter((b) => {
    if (isEditMode && b.id === editLink?.branchId) return true;
    const stat = branchRoleStats.find((s) => s.branchId === b.id);
    const hasOwner = Boolean(stat?.hasOwner);
    const hasPartner = Boolean(stat?.hasPartner);
    if (role === 'owner') return !hasOwner && !hasPartner;
    if (role === 'partner') return !hasOwner;
    return true; // manager/agent
  });

  const selectedBranchId = isEditMode ? editLink!.branchId : Number(branchId || 0);
  const selectedBranchBlocked = useMemo(() => {
    if (!selectedBranchId) return false;
    if (availableBranches.some((b) => b.id === selectedBranchId)) return false;
    return true;
  }, [availableBranches, selectedBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBranchId = isEditMode ? editLink!.branchId : Number(branchId);
    if (!targetBranchId || !window.electronAPI?.employerLinkBranch) return;
    if (selectedBranchBlocked) {
      toast.error(t('employers.linkRoleBranchNotAllowed'));
      return;
    }
    const normalizedOwnership =
      role === 'owner' ? 100 :
      role === 'manager' || role === 'agent' ? 0 :
      (ownershipPercent ? Number(ownershipPercent) : 0);
    if (!Number.isFinite(normalizedOwnership) || normalizedOwnership < 0 || normalizedOwnership > 100) {
      toast.error(t('employers.linkInvalidShare'));
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.employerLinkBranch({
        employerId,
        branchId: targetBranchId,
        role,
        ownershipPercent: normalizedOwnership,
      });
      if (!res?.success) {
        if (res?.error === 'OWNER_CONFLICT') toast.error(t('employers.linkOwnerConflict'));
        else if (res?.error === 'PARTNER_BLOCKED_BY_OWNER') toast.error(t('employers.linkPartnerBlockedByOwner'));
        else if (res?.error === 'PARTNER_TOTAL_EXCEEDED') toast.error(t('employers.linkPartnerTotalExceeded'));
        else if (res?.error === 'INVALID_SHARE') toast.error(t('employers.linkInvalidShare'));
        else if (res?.error === 'INVALID_ROLE') toast.error(t('employers.linkInvalidRole'));
        else toast.error(t('employers.saveFailed'));
        return;
      }
      setBranchId('');
      setOwnershipPercent('');
      onLinked();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-charcoal/10">
          <h3 className="font-bold text-dark-charcoal flex items-center gap-2">
            <Building2 size={18} /> {t('employers.linkModalTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-dark-charcoal/60 hover:bg-gray-100 hover:text-dark-charcoal"
            aria-label={t('employers.closeAria')}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-primary-gold" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal/80 mb-1">{t('employers.roleLabel')}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-dark-charcoal/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold/30"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal/80 mb-1">{t('employers.ownershipPercent')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={ownershipPercent}
                  onChange={(e) => setOwnershipPercent(e.target.value)}
                  className="w-full border border-dark-charcoal/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold/30"
                  placeholder={t('employers.optional')}
                  disabled={role === 'owner' || role === 'manager' || role === 'agent'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal/80 mb-1">{t('employers.branchLabel')}</label>
                {isEditMode ? (
                  <p className="w-full border border-dark-charcoal/10 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-dark-charcoal">
                    {editLink!.branchName}
                  </p>
                ) : (
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full border border-dark-charcoal/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold/30"
                    required
                  >
                    <option value="">{t('employers.chooseBranch')}</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.tradeName || b.name} {b.code ? `(${b.code})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!isEditMode && availableBranches.length === 0 && !loading && (
                  <p className="text-xs text-dark-charcoal/50 mt-1">{t('employers.linkNoBranchesForRole')}</p>
                )}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-dark-charcoal/15 rounded-lg text-dark-charcoal/70 hover:bg-gray-50"
            >
              {t('employers.cancel')}
            </button>
            <button
              type="submit"
              disabled={(!branchId && !isEditMode) || saving || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-gold text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary-gold/90"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isEditMode ? t('employers.saveEdit') : t('employers.link')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
