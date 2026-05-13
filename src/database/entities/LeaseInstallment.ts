import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { BranchLease } from './BranchLease';

@Entity('lease_installments')
export class LeaseInstallment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  leaseId!: number;

  @ManyToOne(() => BranchLease, (lease) => lease.installments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'leaseId' })
  lease!: BranchLease;

  @Column({ type: 'integer' })
  seq!: number;

  @Column({ type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'boolean', default: false })
  paid!: boolean;

  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
