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

@Entity('branch_custom_fields')
export class BranchCustomField {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  branchId!: number;

  @ManyToOne(() => Branch, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'boolean', default: false })
  enableAlert!: boolean;

  @Column({ type: 'date', nullable: true })
  alertDate?: Date;

  @Column({ type: 'integer', nullable: true })
  daysBeforeExpiry?: number; // Days before expiry to show reminder

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
