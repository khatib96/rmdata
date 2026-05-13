import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './Employee';
import { Vehicle } from './Vehicle';
import { Phone } from './Phone';
import { HousingUnit } from './HousingUnit';
import { BranchLicense } from './BranchLicense';
import { BranchLease } from './BranchLease';
import { BranchEstablishment } from './BranchEstablishment';
import { BranchCustomField } from './BranchCustomField';

export enum BranchType {
  STORE = 'store',
  WORKSHOP = 'workshop',
  OFFICE = 'office',
  WAREHOUSE = 'warehouse',
  WEBSITE = 'website',
}

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code?: string; // RMB0001, RMB0002, ...

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nameEn?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, default: 'United Arab Emirates' })
  country!: string;

  @Column({ type: 'varchar', length: 50 })
  emirate!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tradeLicenseNo?: string;

  @Column({ type: 'date', nullable: true })
  tradeLicenseExpiry?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  establishmentCardNo?: string;

  @Column({ type: 'date', nullable: true })
  establishmentCardExpiry?: Date;

  @Column({
    type: 'varchar',
    length: 20,
    enum: BranchType,
    default: BranchType.STORE,
  })
  branchType!: BranchType;

  @Column({ type: 'boolean', default: false })
  isAttached!: boolean;

  @Column({ type: 'integer', nullable: true })
  attachedToId?: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'attachedToId' })
  attachedTo?: Branch;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoPath?: string;

  /** single_shift | double_shift */
  @Column({ type: 'varchar', length: 20, nullable: true })
  workHours?: string;

  /** JSON or text e.g. "09:00-18:00" or "08:00-14:00,16:00-22:00" */
  @Column({ type: 'text', nullable: true })
  workTimingSlots?: string;

  /** active | suspended */
  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @OneToMany(() => Employee, (employee) => employee.workBranch)
  employees!: Employee[];

  @OneToMany(() => Vehicle, (vehicle) => vehicle.branch)
  vehicles!: Vehicle[];

  @OneToMany(() => Phone, (phone) => phone.assignedBranch)
  phones!: Phone[];

  @OneToMany(() => HousingUnit, (housing) => housing.branch)
  housingUnits!: HousingUnit[];

  @OneToMany(() => BranchLicense, (license) => license.branch)
  licenses!: BranchLicense[];

  @OneToMany(() => BranchLease, (lease) => lease.branch)
  leases!: BranchLease[];

  @OneToMany(() => BranchEstablishment, (establishment) => establishment.branch)
  establishments!: BranchEstablishment[];

  @OneToMany(() => BranchCustomField, (field) => field.branch)
  customFields!: BranchCustomField[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
