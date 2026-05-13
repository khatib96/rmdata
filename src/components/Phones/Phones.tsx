import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store, User, ChevronLeft, Building2 } from 'lucide-react';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePermissions } from '../../hooks/usePermissions';
import { PHONE_ICON_MAP } from '../Icons/PhoneIcons';

import AddPhoneModal from './AddPhoneModal';
import { getActiveBranchesForPhoneAssignments, getActiveLegalEntityBranchOptions } from '../../services/branchService';
import { getAssignableEmployeesForPhones } from '../../services/employeeService';
import { getAssignableEmployersForPhones } from '../../services/employerService';
import { getActiveHousingForPhoneAssignments } from '../../services/housingService';

interface Phone {
  id: number;
  code?: string;
  phoneNumber?: string;
  provider?: string;
  category?: string;
  numberType?: string;
  registeredName?: string;
  assignedBranchId?: number;
  assignedEmployeeId?: number;
  assignedEmployerId?: number;
  assignedHousingId?: number;
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

export default function Phones() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistedViewMode('phones_viewMode', 'list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPhoneId, setEditPhoneId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [employers, setEmployers] = useState<{ id: number; name: string }[]>([]);
  const [housings, setHousings] = useState<{ id: number; name: string }[]>([]);
  const [legalEntities, setLegalEntities] = useState<{ id: number; name: string }[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.dbQuery) {
        // Load Phones
        const result = await window.electronAPI.dbQuery(
          `SELECT p.id, p.code, p.phoneNumber, p.provider, p.category, p.numberType, p.registeredName, p.legalEntityId,
           p.assignedBranchId, p.assignedEmployeeId, p.assignedEmployerId, p.assignedHousingId,
           b.name as assignedBranchName, b.photoPath as assignedBranchImage, b.code as assignedBranchCode,
           e.name as assignedEmployeeName, e.imagePath as assignedEmployeeImage, e.code as assignedEmployeeCode,
           o.fullName as assignedEmployerName, o.code as assignedEmployerCode,
           h.name as assignedHousingName, h.code as assignedHousingCode
           FROM phones p
           LEFT JOIN branches b ON p.assignedBranchId = b.id
           LEFT JOIN employees e ON p.assignedEmployeeId = e.id
           LEFT JOIN employers o ON p.assignedEmployerId = o.id
           LEFT JOIN housing_units h ON p.assignedHousingId = h.id
           WHERE (p.status IS NULL OR p.status != 'archived')
           ORDER BY p.id DESC`
        );
        setPhones(result?.success && Array.isArray(result?.data) ? (result.data as Phone[]) : []);

        // Load Lookup Data
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
      }
    } catch (err) {
      console.error('Error loading phone data:', err);
      setPhones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!can('phones', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('phones.title')}</h1>
        <div className="flex items-center gap-3">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          {can('phones', 'create') && (
            <button
              type="button"
              onClick={() => {
                setEditPhoneId(null);
                setShowAddModal(true);
              }}
              className="bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors"
            >
              {t('phones.addPhone')}
            </button>
          )}
        </div>
      </div>

      {(showAddModal || editPhoneId) && (
        <AddPhoneModal 
          editPhoneId={editPhoneId}
          onClose={() => {
            setShowAddModal(false);
            setEditPhoneId(null);
          }}
          onSuccess={loadData}
          branches={branches}
          employees={employees}
          employers={employers}
          housings={housings}
          legalEntities={legalEntities}
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p className="text-secondary-gray">{t('phones.loading')}</p>
        ) : phones.length === 0 ? (
          <p className="text-secondary-gray">{t('phones.noPhones')}</p>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {phones.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/dashboard/phones/${p.id}`)}
                className="bg-white p-3 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col"
              >
                <div className="w-full h-40 mb-3 flex items-center justify-center rounded-lg bg-secondary-gray/30">
                  {(() => {
                    const Icon = PHONE_ICON_MAP[p.numberType as keyof typeof PHONE_ICON_MAP] || PHONE_ICON_MAP['mobile'];
                    return <Icon size={56} className="text-primary-gold" />;
                  })()}
                </div>
                <div className="flex flex-col items-center text-center flex-1">
                  <h3 className="font-bold text-primary-gold text-lg" dir="ltr">{p.phoneNumber || '—'}</h3>
                  {p.code && <p className="text-xs text-dark-charcoal/50 font-mono mb-1">{p.code}</p>}
                  <div className="text-sm text-dark-charcoal/70 mt-1 flex flex-col items-center gap-1">
                    <span>{p.category === 'prepaid' ? t('phones.categoryPrepaid') : t('phones.categoryPostpaid')}</span>
                    
                    {p.assignedEmployeeId ? (
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-dark-charcoal text-xs font-medium flex items-center justify-center gap-1">
                          <User size={12} className="shrink-0" />
                          {p.assignedEmployeeName}
                        </span>
                        {p.assignedEmployeeCode && <span className="text-[11px] text-dark-charcoal/50 font-mono mt-0.5" dir="ltr">({p.assignedEmployeeCode})</span>}
                      </div>
                    ) : p.assignedEmployerId ? (
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-dark-charcoal text-xs font-medium flex items-center justify-center gap-1">
                          <User size={12} className="shrink-0" />
                          {p.assignedEmployerName}
                        </span>
                        {p.assignedEmployerCode && <span className="text-[11px] text-dark-charcoal/50 font-mono mt-0.5" dir="ltr">({p.assignedEmployerCode})</span>}
                      </div>
                    ) : p.assignedBranchId ? (
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-dark-charcoal text-xs font-medium flex items-center justify-center gap-1">
                          <Store size={12} className="shrink-0" />
                          {p.assignedBranchName}
                        </span>
                        {p.assignedBranchCode && <span className="text-[11px] text-dark-charcoal/50 font-mono mt-0.5" dir="ltr">({p.assignedBranchCode})</span>}
                      </div>
                    ) : p.assignedHousingId ? (
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-dark-charcoal text-xs font-medium flex items-center justify-center gap-1">
                          <Building2 size={12} className="shrink-0" />
                          {p.assignedHousingName}
                        </span>
                        {p.assignedHousingCode && <span className="text-[11px] text-dark-charcoal/50 font-mono mt-0.5" dir="ltr">({p.assignedHousingCode})</span>}
                      </div>
                    ) : (
                      <p className="text-sm text-secondary-gray mt-2">{t('phones.notAssigned')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-light-background">
                <tr>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('phones.tablePhone')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('phones.tableDetails')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('phones.tableAssignment')}</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {phones.map((p) => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/dashboard/phones/${p.id}`)} 
                    className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary-gray/30 flex items-center justify-center shrink-0">
                        {(() => {
                          const Icon = PHONE_ICON_MAP[p.numberType as keyof typeof PHONE_ICON_MAP] || PHONE_ICON_MAP['mobile'];
                          return <Icon size={20} className="text-primary-gold" />;
                        })()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-dark-charcoal" dir="ltr">{p.phoneNumber || '—'}</span>
                        {p.code && <span className="text-xs text-dark-charcoal/50 font-mono" dir="ltr">{p.code}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-dark-charcoal text-sm">
                      <div>{t('phones.provider')}: {p.provider === 'etisalat' ? t('phones.providerEtisalat') : p.provider === 'du' ? t('phones.providerDu') : p.provider || '—'}</div>
                      <div className="text-secondary-gray">{p.category === 'prepaid' ? t('phones.categoryPrepaid') : t('phones.categoryPostpaid')}</div>
                    </td>
                    <td className="py-4 px-4 text-dark-charcoal">
                      {p.assignedEmployeeName ? (
                        <div className="flex items-center gap-2"><User size={16} /> {p.assignedEmployeeName} {p.assignedEmployeeCode && <span className="text-xs text-secondary-gray font-mono">({p.assignedEmployeeCode})</span>}</div>
                      ) : p.assignedEmployerName ? (
                        <div className="flex items-center gap-2"><User size={16} /> {p.assignedEmployerName} {p.assignedEmployerCode && <span className="text-xs text-secondary-gray font-mono">({p.assignedEmployerCode})</span>}</div>
                      ) : p.assignedBranchName ? (
                        <div className="flex items-center gap-2"><Store size={16} /> {p.assignedBranchName} {p.assignedBranchCode && <span className="text-xs text-secondary-gray font-mono">({p.assignedBranchCode})</span>}</div>
                      ) : p.assignedHousingName ? (
                        <div className="flex items-center gap-2"><Store size={16} /> {t('phones.housingLabel')}: {p.assignedHousingName} {p.assignedHousingCode && <span className="text-xs text-secondary-gray font-mono">({p.assignedHousingCode})</span>}</div>
                      ) : (
                        <span className="text-secondary-gray">{t('phones.notLinked')}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-left">
                      <button className="p-2 hover:bg-secondary-gray/30 rounded-lg">
                        <ChevronLeft size={18} className="rotate-180" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
