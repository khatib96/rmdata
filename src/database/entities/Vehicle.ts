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

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code?: string; // RMV0001, RMV0002

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoPath?: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  plateNumber!: string;

  /** كود اللوحة أو الرمز (مثل: أ، د، ...) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  plateCode?: string;

  /** اسم المركبة (وصف أو مسمى) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  vehicleName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'integer', nullable: true })
  year?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicleType?: string; // bus | pickup | suv | sedan

  @Column({ type: 'varchar', length: 20, nullable: true })
  ownershipType?: string; // company | personal

  @Column({ type: 'varchar', length: 200, nullable: true })
  ownerName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  issuePlace?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trafficNo?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  chassisNo?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  engineNo?: string;

  @Column({ type: 'date', nullable: true })
  licenseRegDate?: Date;

  @Column({ type: 'date', nullable: true })
  licenseExpiryDate?: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  insuranceCompany?: string;

  @Column({ type: 'date', nullable: true })
  insuranceExpiryDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  insuranceType?: string; // comprehensive | third_party

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurancePolicyNo?: string;

  @Column({ type: 'integer', nullable: true })
  branchId?: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  /** مسؤول المركبة — موظف معيّن */
  @Column({ type: 'integer', nullable: true })
  responsibleEmployeeId?: number;

  /** مسؤول المركبة — صاحب عمل معيّن */
  @Column({ type: 'integer', nullable: true })
  responsibleEmployerId?: number;

  /** اسم المسؤول (يدوي أو خارجي عند عدم مطابقة موظف/صاحب عمل) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  responsibleName?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
