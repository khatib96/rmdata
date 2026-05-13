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
import { Employee } from './Employee';

export enum PhoneProvider {
  ETISALAT = 'etisalat',
  DU = 'du',
}

export enum PhoneCategory {
  PREPAID = 'prepaid',   // مسبق الدفع
  POSTPAID = 'postpaid', // فاتورة
}

export enum NumberType {
  MOBILE = 'mobile',     // خليوي (10 أرقام)
  LANDLINE = 'landline', // أرضي (9 أرقام)
}

export enum PhoneStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  LOST = 'lost',
  ARCHIVED = 'archived',
}

@Entity('phones')
export class Phone {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber?: string; // e.g., 0544405432 or 041234567

  @Column({
    type: 'varchar',
    length: 50,
    enum: PhoneProvider,
    default: PhoneProvider.ETISALAT,
  })
  provider!: PhoneProvider;

  @Column({
    type: 'varchar',
    length: 50,
    enum: PhoneCategory,
    default: PhoneCategory.POSTPAID,
  })
  category!: PhoneCategory;

  @Column({
    type: 'varchar',
    length: 50,
    enum: NumberType,
    default: NumberType.MOBILE,
  })
  numberType!: NumberType;

  // Postpaid specific
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  billAmount?: number;

  @Column({ type: 'integer', nullable: true })
  legalEntityId?: number; // Company name the postpaid line is under

  // Prepaid specific
  @Column({ type: 'varchar', length: 200, nullable: true })
  registeredName?: string; // Person/Entity registered under legally, if prepaid

  // Assignment - can be assigned to branch or employee
  @Column({ type: 'integer', nullable: true })
  assignedBranchId?: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'assignedBranchId' })
  assignedBranch?: Branch;

  @Column({ type: 'integer', nullable: true })
  assignedEmployeeId?: number;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'assignedEmployeeId' })
  assignedEmployee?: Employee;

  @Column({ type: 'integer', nullable: true })
  assignedHousingId?: number;

  @Column({ type: 'integer', nullable: true })
  assignedEmployerId?: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: PhoneStatus,
    default: PhoneStatus.ACTIVE,
  })
  status!: PhoneStatus;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
