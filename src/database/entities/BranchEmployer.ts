import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * جدول ربط أصحاب العمل بالأفرع
 * يسمح بتعدد الشركاء في فرع واحد مع تحديد الدور ونسبة الملكية
 */
@Entity('branch_employers')
export class BranchEmployer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  branchId!: number;

  @Column({ type: 'integer' })
  employerId!: number;

  /**
   * دور صاحب العمل في الرخصة:
   * owner    = مالك
   * partner  = شريك
   * manager  = مدير مسؤول
   * agent    = وكيل خدمات (0%)
   */
  @Column({ type: 'varchar', length: 30, default: 'owner' })
  role!: string;

  /** نسبة الملكية % (0.00 - 100.00) */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ownershipPercent?: number;

  @CreateDateColumn()
  createdAt!: Date;
}
