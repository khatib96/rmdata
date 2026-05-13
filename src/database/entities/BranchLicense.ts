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

@Entity('branch_licenses')
export class BranchLicense {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  branchId!: number;

  @ManyToOne(() => Branch, (branch) => branch.licenses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column({ type: 'varchar', length: 100 })
  licenseNo!: string;

  @Column({ type: 'varchar', length: 200 })
  tradeName!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tradeNameEn?: string;

  @Column({ type: 'date', nullable: true })
  issueDate?: Date;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  renewalFee?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
