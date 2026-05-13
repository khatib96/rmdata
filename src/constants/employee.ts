/**
 * Employee enums - shared between frontend and DB.
 * Do not import from database/entities/Employee in React - TypeORM entities use CommonJS.
 */

export const ContractType = {
  PERMANENT: 'permanent',
  TEMPORARY: 'temporary',
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

export const EmploymentStatus = {
  ACTIVE: 'active',
  LEAVE: 'leave',
  SUSPENDED: 'suspended',
  SECONDED: 'seconded',
  INACTIVE: 'inactive',
  VISA_CANCELLED: 'visa_cancelled',
  TERMINATED: 'terminated',
  ARCHIVED: 'archived',
} as const;
export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus];

export const LoanType = {
  EXTERNAL: 'external',
  INTERNAL: 'internal',
} as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

/** حالة فرعية عند الإعارة الداخلية: يعمل، إجازة، لا يعمل */
export const LoanSubStatus = {
  ACTIVE: 'active',
  LEAVE: 'leave',
  INACTIVE: 'inactive',
} as const;
export type LoanSubStatus = (typeof LoanSubStatus)[keyof typeof LoanSubStatus];
