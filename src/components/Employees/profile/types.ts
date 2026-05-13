export interface EmployeeDetails {
  id: number;
  code?: string;
  name: string;
  nationality?: string;
  email?: string;
  phone?: string;
  imagePath?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiry?: string;
  emiratesId?: string;
  emiratesIdIssueDate?: string;
  emiratesIdExpiry?: string;
  issueEmirate?: string;
  employerName?: string;
  establishmentNumber?: string;
  immigrationEstablishmentNumber?: string;
  contractType?: string;
  profession?: string;
  professionKeys?: string | null;
  professionCustomTitle?: string | null;
  professionPerContract?: string;
  contractStartDate?: string;
  contractExpiryDate?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  totalSalary?: number;
  status: string;
  loanType?: string;
  loanSubStatus?: string;
  targetEntityName?: string;
  loanExpiryDate?: string;
  tempContractNumber?: string;
  loanSalary?: number;
  loanBranchId?: number;
  loanBranchTradeName?: string;
  loanProfession?: string;
  workBranchId?: number;
  contractBranchId?: number;
  contractBranchName?: string;
  contractBranchTradeName?: string;
  actualSalary?: number;
  workBranchName?: string;
  workBranchType?: string;
  loanBranchName?: string;
  healthInsuranceEnabled?: number;
  healthInsuranceProvider?: string;
  healthInsuranceIssueDate?: string;
  healthInsuranceExpiryDate?: string;
  unemploymentInsuranceEnabled?: number;
  unemploymentInsuranceProvider?: string;
  unemploymentInsuranceIssueDate?: string;
  unemploymentInsuranceExpiryDate?: string;
  loanLeaveStartDate?: string | null;
  loanLeaveEndDate?: string | null;
}

export interface EmployeeDocument {
  id: number;
  relativePath: string;
  customName: string | null;
  section: string | null;
}

export interface EmployeePhone {
  id: number;
  phoneNumber: string;
  provider: string;
  category: string;
  numberType: string;
  registeredName: string;
}

export interface EmployeeCurrentPeriod {
  status: string;
  startDate: string;
  endDate?: string;
  durationDays?: number;
}
