import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './Branch';
import { Employee } from './Employee';

@Entity('entities')
export class LegalEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  entityNickname?: string; // اسم الكيان e.g. أبوظبي وفروعها

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nameEn?: string;

  @Column({ type: 'text', nullable: true })
  registeredAddress?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactNumber?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tradeLicenseNumber?: string;

  @Column({ type: 'date', nullable: true })
  tradeLicenseExpiry?: Date;

  @Column({ type: 'varchar', length: 15, nullable: true })
  trn?: string; // Tax Registration Number - 15 digits UAE

  @Column({ type: 'varchar', length: 50, nullable: true })
  vatTrn?: string;

  @Column({ type: 'date', nullable: true })
  vatRegDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  corporateTaxGiban?: string; // Corporate Tax GIBAN/Registration No.

  @Column({ type: 'varchar', length: 50, nullable: true })
  corporateTaxTrn?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vatFilingCycle?: string; // 'quarterly' | 'monthly'

  @Column({ type: 'date', nullable: true })
  corporateTaxRegDate?: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  financialYearEnd?: string; // e.g. "12-31" for Dec 31

  @Column({ type: 'integer', nullable: true })
  mainBranchId?: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'mainBranchId' })
  mainBranch?: Branch;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => Employee, (employee) => employee.legalEntity)
  employees!: Employee[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
