import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Smartphone, Store, Globe, Building2 } from 'lucide-react';
import { getEmirateLabel as getEmirateLabelUtil } from '../../../constants/uae';
import { useLanguageStore } from '../../../store/languageStore';
import { EmploymentStatus, LoanType, LoanSubStatus } from '../../../constants/employee';
import { BRANCH_TYPES } from '../../../constants/branchTypes';
import { getExpiryStatus } from '../../../utils/expiryAlert';
import { ExpiryBadge } from '../../shared/ExpiryBadge';
import WorkshopIcon from '../../Icons/WorkshopIcon';
import type { EmployeeDetails, EmployeePhone } from './types';
import type { PermissionEntry } from '../../../services/permissionsService';
import { canEmployeesFieldView } from '../../../services/permissionsService';
import { canEmployeeFieldInTab, type EmployeeProfileTabId } from '../../../services/employeePermissions';

const BRANCH_TYPE_ICONS: Record<string, typeof Store | typeof WorkshopIcon | typeof Building2 | typeof Globe> = {
  store: Store,
  workshop: WorkshopIcon,
  office: Building2,
  website: Globe,
};

const LOAN_SUB_KEYS: Record<string, string> = {
  [LoanSubStatus.ACTIVE]: 'employees.loanActive',
  [LoanSubStatus.LEAVE]: 'employees.loanLeave',
  [LoanSubStatus.INACTIVE]: 'employees.loanInactive',
};

function shouldShowUpdateButton(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const info = getExpiryStatus(dateStr);
  return info.isExpired || (info.daysLeft != null && info.daysLeft >= 0 && info.daysLeft <= 30);
}

interface EmployeeSummaryProps {
  activeTab: Exclude<EmployeeProfileTabId, 'phones' | 'history' | 'documents'>;
  employee: EmployeeDetails;
  employeePhones: EmployeePhone[];
  workStatusDisplay: string;
  /** بدونها لا تُعرض أزرار تحديث التواريخ (صلاحية تعديل) */
  onOpenExpiryPopup?: (type: 'passport' | 'contract' | 'emiratesId' | 'healthInsurance' | 'unemploymentInsurance' | 'loan') => void;
  /** صلاحيات فعّالة لفرض employees.field.* (الراتب وغيره) */
  permissions?: PermissionEntry[];
}

export default function EmployeeSummary({
  activeTab,
  employee,
  employeePhones,
  workStatusDisplay,
  onOpenExpiryPopup,
  permissions,
}: EmployeeSummaryProps) {
  const { t } = useTranslation();
  const lang = useLanguageStore((s) => s.language);

  const tab = activeTab;
  const f = (fieldAction: string) => canEmployeeFieldInTab(permissions, tab, fieldAction);

  const showSalaryComponents = f('field.salaryComponents.view');
  const showSalaryTotal = f('field.salaryTotal.view');
  const showContractSalary = f('field.contractSalary.view');
  const showAnyContractSalaryInfo = showSalaryComponents || showSalaryTotal || showContractSalary;
  const showActualSalaryField = f('field.actualSalary.view');

  const canPassportExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.passportExpiry.view')
  );
  const canContractExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.contractExpiryField.view')
  );
  const canEmiratesExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.emiratesIdExpiry.view')
  );
  const canHealthInsExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.healthInsuranceFields.view')
  );
  const canUnempInsExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.unemploymentInsuranceFields.view')
  );
  const canLoanExpiryBtn = Boolean(
    onOpenExpiryPopup && canEmployeesFieldView(permissions, 'field.secondedLoanDetails.view')
  );

  return (
    <>
      {activeTab === 'basic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employee.nationality && f('field.nationality.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">الجنسية</label>
              <p className="font-medium">{employee.nationality}</p>
            </div>
          )}
          {employee.email && f('field.email.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                <Mail size={14} /> {t('employees.email')}
              </label>
              <p className="font-medium">{employee.email}</p>
            </div>
          )}
          {(employee.phone || employeePhones.length > 0) && f('field.phone.view') && (
            <div className="md:col-span-2">
              <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                <Phone size={14} /> {t('employees.contactNumbers')}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {employee.phone && (
                  <span
                    className="inline-flex items-center gap-1.5 bg-secondary-gray/10 text-dark-charcoal font-medium px-3 py-1 rounded"
                    dir="ltr"
                  >
                    {employee.phone}
                  </span>
                )}
                {employeePhones.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 bg-primary-gold/10 text-primary-gold font-medium px-3 py-1 rounded"
                    dir="ltr"
                  >
                    {p.numberType === 'landline' ? <Phone size={14} /> : <Smartphone size={14} />}
                    {p.phoneNumber}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!employee.nationality &&
            !employee.email &&
            !employee.phone &&
            employeePhones.length === 0 && (
              <p className="text-secondary-gray">{t('employees.noBasicInfo')}</p>
            )}
        </div>
      )}

      {activeTab === 'passport' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employee.passportNumber && f('field.passportNo.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.passportNumber')}</label>
              <p className="font-medium">{employee.passportNumber}</p>
            </div>
          )}
          {employee.passportIssueDate && f('field.passportIssueDate.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.issueDate')}</label>
              <p className="font-medium">{String(employee.passportIssueDate).slice(0, 10)}</p>
            </div>
          )}
          {f('field.passportExpiry.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.expiryDate')}</label>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">
                  {employee.passportExpiry ? String(employee.passportExpiry).slice(0, 10) : '—'}
                </p>
                {canPassportExpiryBtn && shouldShowUpdateButton(employee.passportExpiry) && (
                  <button
                    type="button"
                    onClick={() => onOpenExpiryPopup?.('passport')}
                    className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                  >
                    {t('employees.update')}
                  </button>
                )}
              </div>
              <ExpiryBadge dateStr={employee.passportExpiry} label={t('employees.passportLabel')} translationNs="employees" />
            </div>
          )}
          {!employee.passportNumber && !employee.passportExpiry && (
            <p className="text-secondary-gray">{t('employees.noPassportData')}</p>
          )}
        </div>
      )}

      {activeTab === 'contract' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(employee.contractBranchTradeName ||
            employee.contractBranchName ||
            employee.workBranchName ||
            (employee.contractType === 'permanent' && employee.employerName)) &&
            f('field.contractTradeName.view') && (
              <div>
                <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                  <Store size={14} /> {t('employees.establishmentTradeName')}
                </label>
                <p className="font-medium">
                  {employee.contractBranchTradeName ||
                    employee.contractBranchName ||
                    employee.workBranchName ||
                    employee.employerName}
                </p>
              </div>
            )}
          {employee.establishmentNumber && f('field.contractEstablishmentNumber.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">رقم منشأة العمل</label>
              <p className="font-medium">{employee.establishmentNumber}</p>
            </div>
          )}
          {(employee.profession || employee.professionPerContract) && f('field.professionContract.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.professionPerContract')}</label>
              <p className="font-medium">{employee.professionPerContract || employee.profession}</p>
            </div>
          )}
          {employee.contractStartDate && f('field.contractStartDate.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.issueDate')}</label>
              <p className="font-medium">{String(employee.contractStartDate).slice(0, 10)}</p>
            </div>
          )}
          {f('field.contractExpiryField.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.expiryDate')}</label>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">
                  {employee.contractExpiryDate ? String(employee.contractExpiryDate).slice(0, 10) : '—'}
                </p>
                {canContractExpiryBtn && shouldShowUpdateButton(employee.contractExpiryDate) && (
                  <button
                    type="button"
                    onClick={() => onOpenExpiryPopup?.('contract')}
                    className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                  >
                    {t('employees.update')}
                  </button>
                )}
              </div>
              <ExpiryBadge dateStr={employee.contractExpiryDate} label={t('employees.contractLabel')} />
            </div>
          )}
          {(employee.basicSalary != null || employee.totalSalary != null) && showAnyContractSalaryInfo && (
            <div className="md:col-span-2">
              <label className="text-sm text-dark-charcoal/70">{t('employees.salary')}</label>
              <p className="font-medium">
                {(showSalaryComponents || showContractSalary) && employee.basicSalary != null && (
                  <>
                    {t('employees.salaryBasic')}: {employee.basicSalary} | {t('employees.salaryHousing')}:{' '}
                    {employee.housingAllowance || 0} | {t('employees.salaryTransport')}:{' '}
                    {employee.transportAllowance || 0}
                  </>
                )}
                {(showSalaryTotal || showContractSalary) && employee.totalSalary != null && (
                  <>
                    {(showSalaryComponents || showContractSalary) && employee.basicSalary != null ? ' | ' : ''}
                    {t('employees.salaryTotal')}: {Number(employee.totalSalary).toLocaleString('en')} {t('employees.aed')}
                  </>
                )}
              </p>
            </div>
          )}
          {!employee.workBranchId && !employee.profession && !employee.professionPerContract && !employee.basicSalary && (
            <p className="text-secondary-gray">{t('employees.noContractData')}</p>
          )}
        </div>
      )}

      {activeTab === 'residency' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employee.emiratesId && f('field.nationalId.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.emiratesIdNumber')}</label>
              <p className="font-medium">{employee.emiratesId}</p>
            </div>
          )}
          {employee.emiratesIdIssueDate && f('field.emiratesIdIssueDate.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.emiratesIdIssueDate')}</label>
              <p className="font-medium">{String(employee.emiratesIdIssueDate).slice(0, 10)}</p>
            </div>
          )}
          {f('field.emiratesIdExpiry.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.emiratesIdExpiryDate')}</label>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">
                  {employee.emiratesIdExpiry ? String(employee.emiratesIdExpiry).slice(0, 10) : '—'}
                </p>
                {canEmiratesExpiryBtn && shouldShowUpdateButton(employee.emiratesIdExpiry) && (
                  <button
                    type="button"
                    onClick={() => onOpenExpiryPopup?.('emiratesId')}
                    className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                  >
                    {t('employees.update')}
                  </button>
                )}
              </div>
              <ExpiryBadge dateStr={employee.emiratesIdExpiry} label={t('employees.emiratesIdLabel')} />
            </div>
          )}
          {employee.issueEmirate && f('field.residencyEmirate.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.issueEmirate')}</label>
              <p className="font-medium">{getEmirateLabelUtil(employee.issueEmirate, lang)}</p>
            </div>
          )}
          {employee.employerName && f('field.residencyEmployer.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.employerTradeName')}</label>
              <p className="font-medium">{employee.employerName}</p>
            </div>
          )}
          {employee.immigrationEstablishmentNumber && f('field.immigrationEstablishment.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.immigrationEstablishmentNo')}</label>
              <p className="font-medium">{employee.immigrationEstablishmentNumber}</p>
            </div>
          )}
          {!employee.emiratesId && !employee.emiratesIdExpiry && !employee.immigrationEstablishmentNumber && (
            <p className="text-secondary-gray">{t('employees.noResidencyData')}</p>
          )}
        </div>
      )}

      {activeTab === 'insurances' && (
        <div className="space-y-6">
          {employee.healthInsuranceEnabled || employee.unemploymentInsuranceEnabled ? (
            <>
              {employee.healthInsuranceEnabled && f('field.healthInsuranceFields.view') && (
                <div className="border border-secondary-gray rounded-lg p-4">
                  <h4 className="text-primary-gold font-bold mb-3">{t('employees.healthInsuranceSection')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employee.healthInsuranceProvider && (
                      <div>
                        <label className="text-sm text-dark-charcoal/70">{t('employees.insuranceProvider')}</label>
                        <p className="font-medium">{employee.healthInsuranceProvider}</p>
                      </div>
                    )}
                    {employee.healthInsuranceIssueDate && (
                      <div>
                        <label className="text-sm text-dark-charcoal/70">{t('employees.issueDate')}</label>
                        <p className="font-medium">{String(employee.healthInsuranceIssueDate).slice(0, 10)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('employees.expiryDate')}</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {employee.healthInsuranceExpiryDate
                            ? String(employee.healthInsuranceExpiryDate).slice(0, 10)
                            : '—'}
                        </p>
                        {canHealthInsExpiryBtn && shouldShowUpdateButton(employee.healthInsuranceExpiryDate) && (
                          <button
                            type="button"
                            onClick={() => onOpenExpiryPopup?.('healthInsurance')}
                            className="text-xs px-2 py-0.5 rounded bg-primary-gold text-white hover:bg-accent-sand"
                          >
                            {t('employees.update')}
                          </button>
                        )}
                      </div>
                      <ExpiryBadge
                        dateStr={employee.healthInsuranceExpiryDate}
                        label={t('employees.healthInsuranceLabel')}
                      />
                    </div>
                  </div>
                </div>
              )}
              {employee.unemploymentInsuranceEnabled && f('field.unemploymentInsuranceFields.view') && (
                <div className="border border-secondary-gray rounded-lg p-4">
                  <h4 className="text-primary-gold font-bold mb-3">{t('employees.unemploymentInsuranceSection')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employee.unemploymentInsuranceProvider && (
                      <div>
                        <label className="text-sm text-dark-charcoal/70">{t('employees.insuranceProvider')}</label>
                        <p className="font-medium">{employee.unemploymentInsuranceProvider}</p>
                      </div>
                    )}
                    {employee.unemploymentInsuranceIssueDate && (
                      <div>
                        <label className="text-sm text-dark-charcoal/70">{t('employees.issueDate')}</label>
                        <p className="font-medium">{String(employee.unemploymentInsuranceIssueDate).slice(0, 10)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('employees.expiryDate')}</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {employee.unemploymentInsuranceExpiryDate
                            ? String(employee.unemploymentInsuranceExpiryDate).slice(0, 10)
                            : '—'}
                        </p>
                        {canUnempInsExpiryBtn && shouldShowUpdateButton(employee.unemploymentInsuranceExpiryDate) && (
                          <button
                            type="button"
                            onClick={() => onOpenExpiryPopup?.('unemploymentInsurance')}
                            className="text-xs px-2 py-0.5 rounded bg-primary-gold text-white hover:bg-accent-sand"
                          >
                            {t('employees.update')}
                          </button>
                        )}
                      </div>
                      <ExpiryBadge
                        dateStr={employee.unemploymentInsuranceExpiryDate}
                        label={t('employees.unemploymentLabel')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-secondary-gray">{t('employees.noInsurances')}</p>
          )}
        </div>
      )}

      {activeTab === 'work-status' && (
        <div className="space-y-4">
          {f('field.workStatusSummary.view') && (
            <div>
              <label className="text-sm text-dark-charcoal/70">{t('employees.workStatus')}</label>
              <p className="font-medium">{workStatusDisplay}</p>
            </div>
          )}
          {(employee.status === EmploymentStatus.ACTIVE || employee.status === EmploymentStatus.LEAVE) && (
            <div className="border border-secondary-gray rounded-lg p-4 space-y-3">
              <h4 className="text-primary-gold font-medium">{t('employees.workingOrLeave')}</h4>
              {employee.workBranchName && f('field.workBranchLink.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.workBranchLabel')}</label>
                  <p className="font-medium flex items-center gap-2">
                    {employee.workBranchType && BRANCH_TYPES.some((bt) => bt.value === employee.workBranchType) &&
                      (() => {
                        const TypeIcon = BRANCH_TYPE_ICONS[employee.workBranchType!] || Store;
                        return <TypeIcon size={18} className="shrink-0 text-primary-gold" />;
                      })()}
                    {employee.workBranchId ? (
                      <Link
                        to={`/dashboard/branches/${employee.workBranchId}`}
                        className="text-primary-gold hover:underline"
                      >
                        {employee.workBranchName}
                      </Link>
                    ) : (
                      employee.workBranchName
                    )}
                  </p>
                </div>
              )}
              {employee.profession && f('field.professionWork.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.professionLabel')}</label>
                  <p className="font-medium">{employee.profession}</p>
                </div>
              )}
              {showActualSalaryField && employee.actualSalary != null && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.actualSalary')}</label>
                  <p className="font-medium">
                    {Number(employee.actualSalary).toLocaleString()} {t('employees.aed')}
                  </p>
                </div>
              )}
            </div>
          )}
          {employee.status === EmploymentStatus.SECONDED && employee.loanType === LoanType.INTERNAL && (
            <>
              {f('field.secondedLoanDetails.view') && employee.workBranchName && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.workBranchLabel')}</label>
                  <p className="font-medium flex items-center gap-2">
                    {employee.workBranchType && BRANCH_TYPES.some((bt) => bt.value === employee.workBranchType) &&
                      (() => {
                        const TypeIcon = BRANCH_TYPE_ICONS[employee.workBranchType!] || Store;
                        return <TypeIcon size={18} className="shrink-0 text-primary-gold" />;
                      })()}
                    {employee.workBranchId ? (
                      <Link
                        to={`/dashboard/branches/${employee.workBranchId}`}
                        className="text-primary-gold hover:underline"
                      >
                        {employee.workBranchName}
                      </Link>
                    ) : (
                      employee.workBranchName
                    )}
                  </p>
                </div>
              )}
              {employee.loanSubStatus && f('field.secondedLoanDetails.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.subStatusLabel')}</label>
                  <p
                    className={`font-medium ${employee.loanSubStatus === LoanSubStatus.ACTIVE ? 'text-success-green' : ''}`}
                  >
                    {LOAN_SUB_KEYS[employee.loanSubStatus]
                      ? t(LOAN_SUB_KEYS[employee.loanSubStatus])
                      : employee.loanSubStatus}
                  </p>
                  <p className="text-xs text-secondary-gray mt-1">* {t('employees.loanInternal')}</p>
                </div>
              )}
              {(employee.loanBranchTradeName || employee.loanBranchName) && f('field.secondedLoanDetails.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.loanedEstablishment')}</label>
                  <p className="font-medium">{employee.loanBranchTradeName || employee.loanBranchName}</p>
                </div>
              )}
              {employee.loanProfession && f('field.secondedLoanDetails.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.loanProfession')}</label>
                  <p className="font-medium">{employee.loanProfession}</p>
                </div>
              )}
              {employee.tempContractNumber && f('field.secondedLoanDetails.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.tempContractNo')}</label>
                  <p className="font-medium">{employee.tempContractNumber}</p>
                </div>
              )}
              {showActualSalaryField &&
                f('field.secondedLoanDetails.view') &&
                (employee.actualSalary != null || employee.loanSalary != null) && (
                  <div>
                    <label className="text-sm text-dark-charcoal/70">{t('employees.actualSalary')}</label>
                    <p className="font-medium">
                      {Number(employee.actualSalary ?? employee.loanSalary).toLocaleString('en')} {t('employees.aed')}
                    </p>
                  </div>
                )}
              {f('field.secondedLoanDetails.view') && (
                <div>
                  <label className="text-sm text-dark-charcoal/70">{t('employees.loanExpiryDate')}</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">
                      {employee.loanExpiryDate ? String(employee.loanExpiryDate).slice(0, 10) : '—'}
                    </p>
                    {canLoanExpiryBtn && shouldShowUpdateButton(employee.loanExpiryDate) && (
                      <button
                        type="button"
                        onClick={() => onOpenExpiryPopup?.('loan')}
                        className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                      >
                        {t('employees.update')}
                      </button>
                    )}
                  </div>
                  <ExpiryBadge dateStr={employee.loanExpiryDate} label={t('employees.loanLabel')} />
                </div>
              )}
            </>
          )}
          {employee.status === EmploymentStatus.TERMINATED && (
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
              <h4 className="text-primary-gold font-medium">{t('employees.terminatedTitle')}</h4>
              <p className="text-sm text-dark-charcoal/70 mt-2">{t('employees.terminatedMessage')}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
