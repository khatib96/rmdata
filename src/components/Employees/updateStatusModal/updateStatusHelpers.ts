import { EmploymentStatus, LoanSubStatus } from '../../../constants/employee';
import { PROFESSIONS } from '../../../constants/professions';

export const WORK_STATUS_KEYS: Record<string, string> = {
  [EmploymentStatus.ACTIVE]: 'employees.statusActive',
  [EmploymentStatus.LEAVE]: 'employees.statusLeave',
  [EmploymentStatus.SUSPENDED]: 'employees.statusSuspended',
  [EmploymentStatus.INACTIVE]: 'employees.statusInactive',
  [EmploymentStatus.SECONDED]: 'employees.statusSeconded',
  [EmploymentStatus.VISA_CANCELLED]: 'employees.statusVisaCancelled',
  [EmploymentStatus.TERMINATED]: 'employees.statusTerminated',
};

export const LOAN_SUB_KEYS: Record<string, string> = {
  [LoanSubStatus.ACTIVE]: 'employees.loanActive',
  [LoanSubStatus.LEAVE]: 'employees.loanLeave',
  [LoanSubStatus.INACTIVE]: 'employees.loanInactive',
};

export function buildProfessionDisplay(keys: string[], customTitle: string, t: (key: string) => string): string {
  if (!keys?.length) return '';
  const parts = keys.map((k) => {
    const p = PROFESSIONS.find((pr) => pr.key === k);
    if (k === 'admin') {
      const base = p ? t(`employees.profession_${p.key}`) : 'إداري';
      return customTitle?.trim() ? `${base}:${customTitle.trim()}` : base;
    }
    if (p?.hasCustomTitle && customTitle) return customTitle;
    return p ? t(`employees.profession_${p.key}`) : k;
  });
  return parts.filter(Boolean).join('، ');
}
