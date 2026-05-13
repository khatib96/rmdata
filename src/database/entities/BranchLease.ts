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
import { LeaseInstallment } from './LeaseInstallment';

@Entity('branch_leases')
export class BranchLease {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  branchId!: number;

  @ManyToOne(() => Branch, (branch) => branch.leases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contractNo?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  landlordName?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount?: number;

  @Column({ type: 'date', nullable: true })
  issueDate?: Date;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'integer', default: 1 })
  installmentsCount!: number;

  @OneToMany(() => LeaseInstallment, (installment) => installment.lease)
  installments!: LeaseInstallment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
