import { useTranslation } from 'react-i18next';
import { ArrowRight, RefreshCw, Pencil, User } from 'lucide-react';
import { getWorkStatusBadgeClass } from '../../../utils/workStatusBadge';
import type { EmployeeDetails } from './types';

interface EmployeeHeaderProps {
  employee: EmployeeDetails;
  imageUrl: string | null;
  workStatusDisplay: string;
  durationText: string | null;
  hasStatusHistory: boolean;
  onBack: () => void;
  onEdit: () => void;
  onUpdateStatus: () => void;
  showEdit?: boolean;
  showUpdateStatus?: boolean;
  /** يطابق `field.profilePhoto.view` في القائمة/الملف */
  showProfilePhoto?: boolean;
  /** يطابق `field.professionDisplay.view` */
  showProfession?: boolean;
}

export default function EmployeeHeader({
  employee,
  imageUrl,
  workStatusDisplay,
  durationText,
  hasStatusHistory,
  onBack,
  onEdit,
  onUpdateStatus,
  showEdit = true,
  showUpdateStatus = true,
  showProfilePhoto = true,
  showProfession = true,
}: EmployeeHeaderProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex justify-start mb-2">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-dark-charcoal hover:text-primary-gold hover:bg-primary-gold/10 transition-colors"
          aria-label="رجوع"
        >
          <ArrowRight size={24} />
        </button>
      </div>

      <div className="flex flex-row items-center justify-between gap-6 mb-6">
        <div className="shrink-0">
          {showProfilePhoto && imageUrl ? (
            <div className="w-40 h-40 rounded-xl overflow-hidden border-2 border-primary-gold/30 shadow-md">
              <img src={imageUrl} alt={employee.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-xl bg-secondary-gray/30 flex items-center justify-center border-2 border-primary-gold/20">
              <User className="text-secondary-gray" size={56} />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
          {employee.code && (
            <span className="inline-block px-2.5 py-1 rounded bg-gray-200 text-dark-charcoal/80 text-xs font-medium mb-2">
              {employee.code}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">{employee.name}</h1>
          {showProfession && employee.profession && (
            <p className="text-sm text-dark-charcoal/60 mt-1">
              {t('employees.professionLabel')}: {employee.profession}
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className={`inline-block px-5 py-2.5 rounded-full text-base font-medium ${getWorkStatusBadgeClass(workStatusDisplay)}`}>
            {workStatusDisplay}
          </span>
          {durationText && (
            <span className="text-sm text-dark-charcoal/70 font-medium">
              {durationText}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      <div className="shrink-0 flex items-center gap-2 justify-end">
        {showUpdateStatus && (
          <button
            type="button"
            onClick={onUpdateStatus}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-primary-gold text-primary-gold hover:bg-primary-gold/10 font-medium"
          >
            <RefreshCw size={18} />
            {hasStatusHistory ? t('employees.updateStatus') : t('employees.setStatus')}
          </button>
        )}
        {showEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
          >
            <Pencil size={18} />
            {t('employees.edit')}
          </button>
        )}
      </div>
    </>
  );
}
