/**
 * Shared types for the frontend - NO database/TypeORM imports.
 * Use these in React components to avoid bundling Node.js code.
 */

export enum UserRole {
  SUPER_ADMIN = 'SuperAdmin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee',
}

export interface AuthUser {
  id: number;
  /** Server-side user ID (for remote/API permission queries) */
  remoteUserId?: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleId?: number;
  branchId?: number;
  entityId?: number;
  userType: 'free' | 'linked';
  linkedEntityType?: 'employee' | 'employer';
  linkedEntityId?: number;
  linkedEntityName?: string;
  linkedEntityImagePath?: string;
  linkedBranchName?: string;
  linkedProfession?: string;
  mustChangePassword: boolean;
  avatarPath?: string;
  isDevAccount?: boolean;
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
}

export interface NotificationItem {
  id: number;
  entityType: string;
  entityId: number;
  title: string;
  message?: string;
  dueDate?: Date;
  severity: NotificationSeverity;
  isRead: boolean;
  relatedField?: string;
  createdAt: Date;
}

/** Minimal types for PDF generation - no TypeORM */
export interface EmployeeForPDF {
  name: string;
  nationality?: string;
  profession?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  totalSalary?: number;
}

export interface BranchForPDF {
  name: string;
  emirate?: string;
  address?: string;
}

export interface LicenseForPDF {
  licenseNo: string;
  tradeName: string;
  issueDate?: Date | string;
  expiryDate?: Date | string;
}
