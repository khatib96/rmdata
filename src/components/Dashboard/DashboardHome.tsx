import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import { Users, Home, Car, AlertTriangle, Store, User, FileText, Smartphone, Briefcase, Warehouse, Building2, Truck, Bus, Globe, Plus, Edit3, UserCheck, Archive, RotateCcw, Calendar, X } from 'lucide-react';
import { PROFESSION_ICON_MAP } from '../Icons/ProfessionIcons';
import WorkshopIcon from '../Icons/WorkshopIcon';
import TaxIcon from '../Icons/TaxIcon';
import { HOUSING_ICON_MAP } from '../Icons/HousingIcons';
import { PHONE_ICON_MAP } from '../Icons/PhoneIcons';
import { getRecentDashboardActivities, type RecentActivityRow } from '../../services/dashboardService';
import { dbQuery } from '../../services/dbClient';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';
import PrayerTimesWidget from '../Layout/PrayerTimesWidget';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { GENERAL_WELCOME_MOTIVATION_LINES } from '../../utils/dashboardWelcomeDuas';
import { resolveMessage } from '../../services/companyMessagesResolver';
import { translateLogDetails } from '../../utils/translateLogDetails';

interface CountRow {
  type: string;
  count: number;
}

interface EmployeeProfessionRow {
  professionKeys?: string | string[] | null;
}

interface ExpiryAlert {
  id: string;
  type: 'branch' | 'employee' | 'vehicle';
  name: string;
  documentKey: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

interface BranchExpiryRow {
  id: number;
  name: string;
  licenseExpiry?: string | null;
  leaseExpiry?: string | null;
  estExpiry?: string | null;
}

interface EmployeeExpiryRow {
  id: number;
  name: string;
  passportExpiry?: string | null;
  emiratesIdExpiry?: string | null;
  workCardExpiry?: string | null;
  healthInsuranceExpiryDate?: string | null;
  contractExpiryDate?: string | null;
  loanExpiryDate?: string | null;
  unemploymentInsuranceExpiryDate?: string | null;
}

interface VehicleExpiryRow {
  id: number;
  plateNumber: string;
  licenseExpiryDate?: string | null;
  insuranceExpiryDate?: string | null;
}

const buildCountMap = (rows: CountRow[] | undefined, fallbackType: string) => {
  const types: Record<string, number> = {};
  let total = 0;

  for (const row of rows || []) {
    const type = row.type || fallbackType;
    const count = Number(row.count || 0);
    types[type] = count;
    total += count;
  }

  return { total, types };
};

const MODULE_LABELS_AR: Record<string, string> = {
  employee: 'الموظفون', branch: 'الأفرع', vehicle: 'المركبات', housing: 'السكن',
  phone: 'الهواتف', tax: 'الضرائب', entity: 'الكيانات', employer: 'أصحاب العمل', archive: 'الأرشيف',
};
const MODULE_LABELS_EN: Record<string, string> = {
  employee: 'Employees', branch: 'Branches', vehicle: 'Vehicles', housing: 'Housing',
  phone: 'Phones', tax: 'Taxes', entity: 'Entities', employer: 'Employers', archive: 'Archive',
};

const ACTION_LABELS_AR: Record<string, string> = {
  status_change: 'تحديث حالة', expiry_update: 'تحديث وثيقة', create: 'إضافة', edit: 'تعديل',
  archive: 'أرشفة', restore: 'استعادة', assign_responsible: 'تعيين مسؤول', assign_occupant: 'تعيين ساكن',
  remove_occupant: 'إزالة ساكن', date_correction: 'تصحيح تاريخ',
};
const ACTION_LABELS_EN: Record<string, string> = {
  status_change: 'Status change', expiry_update: 'Expiry update', create: 'Create', edit: 'Edit',
  archive: 'Archive', restore: 'Restore', assign_responsible: 'Assign responsible', assign_occupant: 'Assign occupant',
  remove_occupant: 'Remove occupant', date_correction: 'Date correction',
};

const ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  create: <Plus size={13} />, edit: <Edit3 size={13} />, status_change: <UserCheck size={13} />,
  expiry_update: <Calendar size={13} />, archive: <Archive size={13} />, restore: <RotateCcw size={13} />,
  assign_responsible: <UserCheck size={13} />, assign_occupant: <UserCheck size={13} />,
  remove_occupant: <X size={13} />, date_correction: <Calendar size={13} />,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700', edit: 'bg-blue-100 text-blue-700',
  status_change: 'bg-indigo-100 text-indigo-700', expiry_update: 'bg-amber-100 text-amber-700',
  archive: 'bg-orange-100 text-orange-700', restore: 'bg-green-100 text-green-700',
  assign_responsible: 'bg-cyan-100 text-cyan-700', assign_occupant: 'bg-teal-100 text-teal-700',
  remove_occupant: 'bg-rose-100 text-rose-700', date_correction: 'bg-purple-100 text-purple-700',
};

export default function DashboardHome() {
  const { t } = useTranslation();
  const { expiryWarningDays, showYellowExpiry } = useExpiryUiSettings();
  const { user } = useAuthStore();
  const { dir } = useLanguageStore();
  const { canSection } = usePermissions();
  const isAr = dir === 'rtl';
  const moduleLabels = isAr ? MODULE_LABELS_AR : MODULE_LABELS_EN;
  const actionLabels = isAr ? ACTION_LABELS_AR : ACTION_LABELS_EN;
  const displayName = user?.fullName || user?.username || 'المستخدم';
  const [hijriDate, setHijriDate] = useState('');
  const [duaText, setDuaText] = useState<string>(GENERAL_WELCOME_MOTIVATION_LINES[0]);
  const [stats, setStats] = useState({
    branches: { total: 0, types: {} as Record<string, number> },
    employees: { total: 0, types: {} as Record<string, number> },
    vehicles: { total: 0, types: {} as Record<string, number> },
    housing: { total: 0, types: {} as Record<string, number> },
    phones: { total: 0, types: {} as Record<string, number> },
    entities: { total: 0 }
  });

  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(today);
    setHijriDate(hijri);
  }, []);

  useEffect(() => {
    resolveMessage(new Date())
      .then((r) => {
        if (r?.text_ar) setDuaText(r.text_ar);
      })
      .catch(() => {
        // keep default GENERAL_WELCOME_MOTIVATION_LINES[0] already in state
      });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const fetchDashboardData = async () => {
      if (!window.electronAPI?.dbQuery) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Stats
        const [branchesRes, employeesRes, vehiclesRes, housingRes, phonesRes, entitiesRes] = await Promise.all([
          dbQuery<CountRow[]>(
            `SELECT COALESCE(branchType, 'other') as type, COUNT(*) as count
                   FROM branches
                   WHERE status IS NULL OR status != ?
                   GROUP BY COALESCE(branchType, 'other')`,
            ['archived'],
            { signal }
          ),
          dbQuery<EmployeeProfessionRow[]>('SELECT professionKeys FROM employees WHERE status IS NULL OR status != ?', ['archived'], { signal }),
          dbQuery<CountRow[]>(
            `SELECT COALESCE(vehicleType, 'other') as type, COUNT(*) as count
                   FROM vehicles
                   GROUP BY COALESCE(vehicleType, 'other')`,
            undefined,
            { signal }
          ),
          dbQuery<CountRow[]>(
            `SELECT COALESCE(housingType, 'labour') as type, COUNT(*) as count
                   FROM housing_units
                   WHERE status IS NULL OR status != ?
                   GROUP BY COALESCE(housingType, 'labour')`,
            ['archived'],
            { signal }
          ),
          dbQuery<CountRow[]>(
            `SELECT COALESCE(numberType, 'mobile') as type, COUNT(*) as count
                   FROM phones
                   WHERE status IS NULL OR status != ?
                   GROUP BY COALESCE(numberType, 'mobile')`,
            ['archived'],
            { signal }
          ),
          dbQuery<{ c?: number }[]>('SELECT COUNT(*) as c FROM entities WHERE status IS NULL OR status != ?', ['archived'], { signal })
        ]);

        if (signal.aborted) return;

        const branchesStats = buildCountMap((branchesRes?.data ?? []) as CountRow[], 'other');

        const employeeTypes: Record<string, number> = {};
        let employeesTotal = 0;
        if (employeesRes?.data) {
          (employeesRes.data as EmployeeProfessionRow[]).forEach((e) => {
            let prof = 'other';
            if (e.professionKeys) {
               try {
                  const parsed = typeof e.professionKeys === 'string' ? JSON.parse(e.professionKeys) : e.professionKeys;
                  if (Array.isArray(parsed) && parsed.length > 0) prof = parsed[0];
               } catch(ex) {}
            }
            employeeTypes[prof] = (employeeTypes[prof] || 0) + 1;
            employeesTotal++;
          });
        }

        const vehiclesStats = buildCountMap((vehiclesRes?.data ?? []) as CountRow[], 'other');
        const housingStats = buildCountMap((housingRes?.data ?? []) as CountRow[], 'labour');
        const phonesStats = buildCountMap((phonesRes?.data ?? []) as CountRow[], 'mobile');

        setStats({
          branches: branchesStats,
          employees: { total: employeesTotal, types: employeeTypes },
          vehicles: vehiclesStats,
          housing: housingStats,
          phones: phonesStats,
          entities: { total: ((entitiesRes?.data as Array<{ c?: number }>)?.[0]?.c ?? 0) }
        });

        // Expiry Alerts
        const newAlerts: ExpiryAlert[] = [];
        const today = new Date();
        const warningDaysFromNow = new Date();
        warningDaysFromNow.setDate(today.getDate() + expiryWarningDays);

        const checkExpiry = (dateStr: string | null | undefined, name: string, docKey: string, type: 'branch'|'employee'|'vehicle', id: string) => {
          if (!dateStr) return;
          let expDate = new Date(dateStr);
          if (isNaN(expDate.getTime()) && dateStr.includes('-')) {
             const parts = dateStr.split('T')[0].split('-');
             if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
                 expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
             }
          }
          if (isNaN(expDate.getTime())) return;

          if (expDate <= warningDaysFromNow) {
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isExpired = diffDays < 0;
            // showYellowExpiry controls "near expiry" alerts; expired alerts are always shown.
            if (isExpired || showYellowExpiry) {
              newAlerts.push({
                id: `${type}-${id}-${docKey}`,
                type,
                name,
                documentKey: docKey,
                expiryDate: dateStr,
                daysUntilExpiry: diffDays
              });
            }
          }
        };

        const [branchesExpiry, empExpiry, vehExpiry] = await Promise.all([
          dbQuery<BranchExpiryRow[]>(
            `SELECT b.id, b.name, l.expiryDate as licenseExpiry, le.expiryDate as leaseExpiry, e.immigrationCardExpiryDate as estExpiry 
                    FROM branches b 
                    LEFT JOIN branch_licenses l ON b.id = l.branchId 
                    LEFT JOIN branch_leases le ON b.id = le.branchId 
                    LEFT JOIN branch_establishments e ON b.id = e.branchId 
                    WHERE b.status IS NULL OR b.status != ?`,
            ['archived'],
            { signal }
          ),
          dbQuery<EmployeeExpiryRow[]>(
            'SELECT id, name, passportExpiry, emiratesIdExpiry, workCardExpiry, healthInsuranceExpiryDate, contractExpiryDate, loanExpiryDate, unemploymentInsuranceExpiryDate FROM employees WHERE status IS NULL OR status != ?',
            ['archived'],
            { signal }
          ),
          dbQuery<VehicleExpiryRow[]>('SELECT id, plateNumber, licenseExpiryDate, insuranceExpiryDate FROM vehicles', undefined, { signal })
        ]);

        if (signal.aborted) return;

        if (branchesExpiry?.data) {
          branchesExpiry.data.forEach((b) => {
            checkExpiry(b.licenseExpiry, b.name, 'tradeLicense', 'branch', String(b.id));
            checkExpiry(b.leaseExpiry, b.name, 'leaseAgreement', 'branch', String(b.id));
            checkExpiry(b.estExpiry, b.name, 'establishmentCard', 'branch', String(b.id));
          });
        }
        if (empExpiry?.data) {
          empExpiry.data.forEach((e) => {
             checkExpiry(e.passportExpiry, e.name, 'passport', 'employee', String(e.id));
             checkExpiry(e.emiratesIdExpiry, e.name, 'emiratesId', 'employee', String(e.id));
             checkExpiry(e.workCardExpiry, e.name, 'workCard', 'employee', String(e.id));
             checkExpiry(e.healthInsuranceExpiryDate, e.name, 'healthInsurance', 'employee', String(e.id));
             checkExpiry(e.contractExpiryDate, e.name, 'workContract', 'employee', String(e.id));
             checkExpiry(e.loanExpiryDate, e.name, 'loan', 'employee', String(e.id));
             checkExpiry(e.unemploymentInsuranceExpiryDate, e.name, 'unemploymentInsurance', 'employee', String(e.id));
          });
        }
        if (vehExpiry?.data) {
          vehExpiry.data.forEach((v) => {
             checkExpiry(v.licenseExpiryDate, v.plateNumber, 'vehicleLicense', 'vehicle', String(v.id));
             checkExpiry(v.insuranceExpiryDate, v.plateNumber, 'vehicleInsurance', 'vehicle', String(v.id));
          });
        }

        newAlerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        if (signal.aborted) return;
        setAlerts(newAlerts);

        const activitiesRes = await getRecentDashboardActivities({ signal });
        if (signal.aborted) return;
        if (activitiesRes?.success && activitiesRes.data) {
          setActivities(activitiesRes.data);
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        console.error('Dashboard fetch error', e);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    void fetchDashboardData();
    return () => ac.abort();
  }, [expiryWarningDays, showYellowExpiry]);

  return (
    <div className="space-y-6">
      <div className="w-full">
        <h1
          className={`text-lg sm:text-xl font-bold text-dark-charcoal ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
        >
          مرحبا <span className="text-primary-gold">{displayName}</span> في نظام إداة شركة الرداء الموحد لليوينفورم
        </h1>

        <div className="mt-3" dir="ltr">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <div dir="rtl" className="h-full min-h-0 flex">
              <div className="w-full min-h-full flex flex-col">
                <PrayerTimesWidget className="flex-1 min-h-full" />
              </div>
            </div>

            <div dir="rtl" className="h-full min-h-0 flex">
              <div className="bg-secondary-gray/15 backdrop-blur rounded-2xl border border-secondary-gray/30 p-4 h-full w-full flex flex-col justify-center">
                <div className="text-center mb-4">
                  <div className="text-base sm:text-lg text-primary-gold font-semibold">{hijriDate}</div>
                </div>
                <p className="text-center text-sm sm:text-base font-semibold text-dark-charcoal leading-relaxed px-1 line-clamp-2">
                  {duaText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Branches */}
        {canSection('branches') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-4 mb-4">
            <div className={`bg-primary-gold/10 p-3 rounded-lg text-primary-gold`}>
              <Store size={28} />
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-charcoal">{stats.branches.total}</p>
              <p className="text-sm font-medium text-secondary-gray">الأفرع والمنشآت</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-3 border-t border-secondary-gray/20 pb-1">
            {Object.entries(stats.branches.types).slice(0, 4).map(([type, count]) => {
              const Icon = type === 'store' ? Store : type === 'warehouse' ? Warehouse : type === 'office' ? Briefcase : type === 'workshop' ? WorkshopIcon : type === 'website' ? Globe : Building2;
              return (
                <div key={type} title={type} className="flex items-center gap-1.5 bg-secondary-gray/5 px-2.5 py-1.5 rounded-lg border border-secondary-gray/10 shrink-0">
                  <Icon size={16} className="text-primary-gold" />
                  <span className="font-bold text-dark-charcoal text-sm">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.branches.types).length === 0 && <span className="text-xs text-secondary-gray">{t('dashboard.noData')}</span>}
          </div>
        </div>}

        {/* Employees */}
        {canSection('employees') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-4 mb-4">
            <div className={`bg-primary-gold/10 p-3 rounded-lg text-primary-gold`}>
              <Users size={28} />
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-charcoal">{stats.employees.total}</p>
              <p className="text-sm font-medium text-secondary-gray">{t('dashboard.employees')}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-3 border-t border-secondary-gray/20 pb-1">
            {Object.entries(stats.employees.types).sort((a,b)=>b[1]-a[1]).slice(0, 4).map(([type, count]) => {
              const Icon = PROFESSION_ICON_MAP[type] || User;
              return (
                <div key={type} title={type} className="flex items-center gap-1.5 bg-secondary-gray/5 px-2.5 py-1.5 rounded-lg border border-secondary-gray/10 shrink-0">
                  <Icon size={16} className="text-primary-gold" />
                  <span className="font-bold text-dark-charcoal text-sm">{count}</span>
                </div>
              );
            })}
             {Object.keys(stats.employees.types).length === 0 && <span className="text-xs text-secondary-gray">{t('dashboard.noData')}</span>}
          </div>
        </div>}

        {/* Vehicles */}
        {canSection('vehicles') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-4 mb-4">
            <div className={`bg-primary-gold/10 p-3 rounded-lg text-primary-gold`}>
              <Car size={28} />
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-charcoal">{stats.vehicles.total}</p>
              <p className="text-sm font-medium text-secondary-gray">{t('dashboard.vehicles')}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-3 border-t border-secondary-gray/20 pb-1">
            {Object.entries(stats.vehicles.types).slice(0, 4).map(([type, count]) => {
              const Icon = type === 'bus' ? Bus : type === 'van' ? Truck : Car;
              return (
                <div key={type} title={type} className="flex items-center gap-1.5 bg-secondary-gray/5 px-2.5 py-1.5 rounded-lg border border-secondary-gray/10 shrink-0">
                  <Icon size={16} className="text-primary-gold" />
                  <span className="font-bold text-dark-charcoal text-sm">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.vehicles.types).length === 0 && <span className="text-xs text-secondary-gray">{t('dashboard.noData')}</span>}
          </div>
        </div>}

        {/* Housing */}
        {canSection('housing') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-4 mb-4">
            <div className={`bg-primary-gold/10 p-3 rounded-lg text-primary-gold`}>
              <Home size={28} />
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-charcoal">{stats.housing.total}</p>
              <p className="text-sm font-medium text-secondary-gray">{t('dashboard.housing')}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-3 border-t border-secondary-gray/20 pb-1">
            {Object.entries(stats.housing.types).slice(0, 4).map(([type, count]) => {
              const Icon = HOUSING_ICON_MAP[type as keyof typeof HOUSING_ICON_MAP] || HOUSING_ICON_MAP['labour'];
              const title = type === 'warehouse' ? t('dashboard.housingWarehouse') : type === 'personal' ? t('dashboard.housingPersonal') : t('dashboard.housingLabour');
              
              return (
                <div key={type} title={title} className="flex items-center gap-1.5 bg-secondary-gray/5 px-2.5 py-1.5 rounded-lg border border-secondary-gray/10 shrink-0">
                  <Icon size={18} className="text-primary-gold" />
                  <span className="font-bold text-dark-charcoal text-sm">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.housing.types).length === 0 && <span className="text-xs text-secondary-gray">{t('dashboard.noData')}</span>}
          </div>
        </div>}
        
        {/* Phones */}
        {canSection('phones') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-4 mb-4">
            <div className={`bg-primary-gold/10 p-3 rounded-lg text-primary-gold`}>
              <Smartphone size={28} />
            </div>
            <div>
              <p className="text-3xl font-bold text-dark-charcoal">{stats.phones.total}</p>
              <p className="text-sm font-medium text-secondary-gray">{t('dashboard.phones')}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-3 border-t border-secondary-gray/20 pb-1">
            {Object.entries(stats.phones.types).slice(0, 4).map(([type, count]) => {
              const isMobile = type === 'mobile';
              const Icon = PHONE_ICON_MAP[type as keyof typeof PHONE_ICON_MAP] || PHONE_ICON_MAP['mobile'];
              const title = isMobile ? t('dashboard.phoneMobile') : t('dashboard.phoneLandline');
              return (
                <div key={type} title={title} className="flex items-center gap-1.5 bg-secondary-gray/5 px-2.5 py-1.5 rounded-lg border border-secondary-gray/10 shrink-0">
                  <Icon size={18} className="text-primary-gold" />
                  <span className="font-bold text-dark-charcoal text-sm">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.phones.types).length === 0 && <span className="text-xs text-secondary-gray">{t('dashboard.noData')}</span>}
          </div>
        </div>}

        {/* Tax Entities */}
        {canSection('entities') && <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 border border-primary-gold/20 relative overflow-hidden group flex flex-col justify-center min-h-[140px]">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary-gold" />
          <div className="flex items-center gap-6 mb-2">
            <div className={`bg-primary-gold/10 p-5 rounded-lg text-primary-gold`}>
              <TaxIcon size={38} />
            </div>
            <div>
              <p className="text-5xl font-bold text-dark-charcoal">{stats.entities.total}</p>
              <p className="text-lg font-medium text-secondary-gray mt-1">{t('dashboard.entities')}</p>
            </div>
          </div>
        </div>}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Expiry Alerts */}
        <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6 border-t-4 border-alert-red">
          <h2 className="text-xl font-bold text-dark-charcoal mb-4 flex items-center gap-2">
            <AlertTriangle className="text-alert-red" /> {t('dashboard.alertsTitle')}
          </h2>
          {loading ? (
             <p className="text-secondary-gray animate-pulse">{t('dashboard.alertsChecking')}</p>
          ) : alerts.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex justify-between items-center p-3 rounded-lg border ${alert.daysUntilExpiry < 0 ? 'bg-alert-red/10 border-alert-red/30' : alert.daysUntilExpiry <= 15 ? 'bg-orange-50 border-orange-200' : 'bg-secondary-gray/5 border-secondary-gray/20'}`}>
                  <div>
                    <h4 className="font-bold text-dark-charcoal text-sm">{alert.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-dark-charcoal/70 mt-1">
                      <FileText size={12} /> {t(`dashboard.docNames.${alert.documentKey}`)}
                      <span className="mx-1">•</span>
                      <span>{t('dashboard.expiryDateLabel')}: {alert.expiryDate}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap ${alert.daysUntilExpiry < 0 ? 'bg-alert-red text-white' : alert.daysUntilExpiry <= 15 ? 'bg-orange-400 text-white' : 'bg-primary-gold/20 text-dark-charcoal'}`}>
                    {alert.daysUntilExpiry < 0 ? t('dashboard.expiredDaysAgo', { count: Math.abs(alert.daysUntilExpiry) }) : alert.daysUntilExpiry === 0 ? t('dashboard.expiresToday') : t('dashboard.daysLeft', { count: alert.daysUntilExpiry })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-secondary-gray">
              <div className="bg-success-green/10 p-4 rounded-full mb-3">
                 <AlertTriangle size={32} className="text-success-green" />
              </div>
              <p className="font-medium text-dark-charcoal">{t('dashboard.allDocumentsValid')}</p>
              <p className="text-sm">{t('dashboard.noAlertsIn30Days')}</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6">
          <h2 className="text-xl font-bold text-dark-charcoal mb-4">
            {t('dashboard.recentActivity')}
          </h2>
          {activities.length > 0 ? (
            <div className="border border-secondary-gray rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="bg-primary-gold/10">
                    <tr>
                      <th className="p-2.5 text-dark-charcoal font-medium text-xs">{isAr ? 'الوقت' : 'Time'}</th>
                      <th className="p-2.5 text-dark-charcoal font-medium text-xs">{isAr ? 'القسم' : 'Module'}</th>
                      <th className="p-2.5 text-dark-charcoal font-medium text-xs">{isAr ? 'الإجراء' : 'Action'}</th>
                      <th className="p-2.5 text-dark-charcoal font-medium text-xs">{isAr ? 'التفاصيل' : 'Details'}</th>
                      <th className="p-2.5 text-dark-charcoal font-medium text-xs">{isAr ? 'المستخدم' : 'User'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.slice(0, 5).map((activity) => {
                      const actionColor = ACTION_COLORS[activity.action] || 'bg-secondary-gray/20 text-dark-charcoal';
                      const detailsText = translateLogDetails(activity.details, t, isAr ? 'ar' : 'en');
                      return (
                        <tr key={activity.id} className="border-t border-secondary-gray/30 hover:bg-secondary-gray/5 transition-colors">
                          <td className="p-2.5 text-dark-charcoal/70 text-[11px] whitespace-nowrap">
                            {activity.createdAt ? String(activity.createdAt).slice(0, 19).replace('T', ' ') : '—'}
                          </td>
                          <td className="p-2.5 text-xs font-medium text-dark-charcoal">
                            {moduleLabels[activity.module] || activity.module}
                          </td>
                          <td className="p-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${actionColor}`}>
                              {ACTION_ICON_MAP[activity.action]}
                              {actionLabels[activity.action] || activity.action}
                            </span>
                          </td>
                          <td className="p-2.5 text-dark-charcoal/70 text-xs max-w-[220px]">
                            <span className="truncate block" title={detailsText}>
                              {detailsText}
                            </span>
                          </td>
                          <td className="p-2.5 text-dark-charcoal/70 text-xs whitespace-nowrap">
                            {activity.performedByUsername || t('dashboard.system')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-secondary-gray text-center py-8">{t('dashboard.noRecentActivity')}</p>
          )}
        </div>

      </div>
    </div>
  );
}
