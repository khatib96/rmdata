import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './Branch';
import { Employee } from './Employee';
import { HousingInstallment } from './HousingInstallment';
import { HousingOccupant } from './HousingOccupant';
import { HousingType } from '../../constants/housing';

export enum OwnedBy {
  COMPANY = 'company',
  EMPLOYEE = 'employee',
  EMPLOYER = 'employer',
  OTHER = 'other',
}

@Entity('housing_units')
export class HousingUnit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code?: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: HousingType.LABOUR,
  })
  housingType!: HousingType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  emirate?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  /** اسم المالك أو المؤجر */
  @Column({ type: 'varchar', length: 200, nullable: true })
  landlordName?: string;

  /** المستأجر (للعرض): اسم أو وصف من يتحمل العقد */
  @Column({ type: 'varchar', length: 200, nullable: true })
  tenantDisplayName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contractNo?: string;

  @Column({ type: 'date', nullable: true })
  contractIssue?: Date;

  @Column({ type: 'date', nullable: true })
  contractExpiry?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  rentAmount?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'integer', default: 1 })
  installmentsCount!: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: OwnedBy,
    default: OwnedBy.COMPANY,
  })
  ownedBy!: OwnedBy;

  @Column({ type: 'integer', nullable: true })
  branchId?: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ type: 'integer', nullable: true })
  employeeId?: number;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employeeId' })
  employee?: Employee;

  /** عند العقد باسم صاحب العمل */
  @Column({ type: 'integer', nullable: true })
  employerId?: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @OneToMany(() => HousingInstallment, (installment) => installment.housing)
  installments!: HousingInstallment[];

  @OneToMany(() => HousingOccupant, (o) => o.housingUnit)
  occupants!: HousingOccupant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
