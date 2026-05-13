/**
 * Branch type options - Arabic labels
 */
export const BRANCH_TYPES = [
  { value: 'store', label: 'متجر' },
  { value: 'workshop', label: 'مشغل' },
  { value: 'office', label: 'مكتب' },
  { value: 'website', label: 'الموقع الإلكتروني' },
] as const;

export type BranchTypeValue = (typeof BRANCH_TYPES)[number]['value'];

export function isLicenseLeaseOptional(branchType: string): boolean {
  return branchType === 'office' || branchType === 'website';
}

/** مكتب أو الموقع الإلكتروني — يظهر حقل الفرع المرتبط ويُخفى الرخصة وعقد الإيجار */
export function isOfficeOrWebsite(branchType: string): boolean {
  return branchType === 'office' || branchType === 'website';
}
