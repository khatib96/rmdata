import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './Branch';
import { LegalEntity } from './Entity';
import { ContractType, EmploymentStatus } from '../../constants/employee';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code?: string; // RME0001, RME0002, ...

  @Column({ type: 'varchar', length: 255, nullable: true })
  imagePath?: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nationality?: string;

  // Passport Information
  @Column({ type: 'varchar', length: 50, nullable: true })
  passportNumber?: string;

  @Column({ type: 'date', nullable: true })
  passportIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  passportExpiry?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  passportCountry?: string;

  // Work Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  profession?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contractType?: ContractType;

  @Column({ type: 'date', nullable: true })
  contractStartDate?: Date;

  @Column({ type: 'date', nullable: true })
  contractExpiryDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  workLicense?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  workCardNumber?: string;

  @Column({ type: 'date', nullable: true })
  workCardExpiry?: Date;

  // Work Location - Hybrid Linking
  @Column({ type: 'integer', nullable: true })
  contractBranchId?: number; // المنشأة في عقد العمل (للعقد الدائم)

  @Column({ type: 'integer', nullable: true })
  workBranchId?: number; // الفرع الذي يعمل فيه

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'workBranchId' })
  workBranch?: Branch;

  // Legal Entity (for visa)
  @Column({ type: 'integer', nullable: true })
  legalEntityId?: number;

  @ManyToOne(() => LegalEntity, { nullable: true })
  @JoinColumn({ name: 'legalEntityId' })
  legalEntity?: LegalEntity;

  // Establishment (for visa issuance)
  @Column({ type: 'integer', nullable: true })
  establishmentId?: number;

  // Emirates ID & Residency
  @Column({ type: 'varchar', length: 50, nullable: true })
  emiratesId?: string;

  @Column({ type: 'date', nullable: true })
  emiratesIdIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  emiratesIdExpiry?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issueEmirate?: string; // إمارة الإصدار

  // Auto-filled from branch when selected
  @Column({ type: 'varchar', length: 200, nullable: true })
  employerName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  establishmentNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  immigrationEstablishmentNumber?: string;

  @Column({ type: 'text', nullable: true })
  professionKeys?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  professionCustomTitle?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  professionPerContract?: string;

  @Column({ type: 'integer', nullable: true, default: 0 })
  healthInsuranceEnabled?: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  healthInsuranceProvider?: string;

  @Column({ type: 'date', nullable: true })
  healthInsuranceIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  healthInsuranceExpiryDate?: Date;

  @Column({ type: 'integer', nullable: true, default: 0 })
  unemploymentInsuranceEnabled?: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  unemploymentInsuranceProvider?: string;

  @Column({ type: 'date', nullable: true })
  unemploymentInsuranceIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  unemploymentInsuranceExpiryDate?: Date;

  // Loan (معار) - when status = SECONDED
  @Column({ type: 'varchar', length: 20, nullable: true })
  loanType?: string; // external | internal

  @Column({ type: 'varchar', length: 200, nullable: true })
  targetEntityName?: string; // for external loan

  @Column({ type: 'date', nullable: true })
  loanExpiryDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tempContractNumber?: string; // for internal loan

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  loanSalary?: number; // راتب الإعارة - for internal loan

  @Column({ type: 'integer', nullable: true })
  loanBranchId?: number; // المنشأة المعار عليها - for internal loan

  @Column({ type: 'varchar', length: 200, nullable: true })
  loanProfession?: string; // المهنة بالإعارة الداخلية

  @Column({ type: 'varchar', length: 20, nullable: true })
  loanSubStatus?: string; // الحالة الفرعية: active|leave|inactive

  /** تاريخ بداية الإجازة/عدم العمل ضمن الإعارة الداخلية */
  @Column({ type: 'date', nullable: true })
  loanLeaveStartDate?: Date;

  /** تاريخ العودة من الإجازة/عدم العمل (نهاية المدة) */
  @Column({ type: 'date', nullable: true })
  loanLeaveEndDate?: Date;

  // Salary Information
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  basicSalary?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  housingAllowance?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  transportAllowance?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  otherAllowances?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalSalary?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualSalary?: number; // Legal Salary

  // Employment Status
  @Column({
    type: 'varchar',
    length: 20,
    default: EmploymentStatus.ACTIVE,
  })
  status!: EmploymentStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
