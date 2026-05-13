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

@Entity('branch_establishments')
export class BranchEstablishment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', unique: true })
  branchId!: number;

  @ManyToOne(() => Branch, (branch) => branch.establishments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  laborEstablishmentCardNo?: string; // Labor Establishment Card Number

  @Column({ type: 'varchar', length: 100, nullable: true })
  immigrationEstablishmentCardNo?: string; // Immigration Establishment Card Number

  @Column({ type: 'date', nullable: true })
  immigrationCardIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  immigrationCardExpiryDate?: Date;

  @Column({ type: 'varchar', length: 15, nullable: true })
  trn?: string; // Tax Registration Number - 15 digits

  @Column({ type: 'varchar', length: 50, nullable: true })
  corporateTaxRegistration?: string; // Corporate Tax Registration

  // Legacy fields (keeping for compatibility)
  @Column({ type: 'varchar', length: 100, nullable: true })
  mohreEstNo?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gdrfaEstNo?: string;

  @Column({ type: 'date', nullable: true })
  gdrfaIssueDate?: Date;

  @Column({ type: 'date', nullable: true })
  gdrfaExpiryDate?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
