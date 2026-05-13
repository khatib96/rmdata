import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('employers')
export class Employer {
  @PrimaryGeneratedColumn()
  id!: number;

  /** رمز صاحب العمل: RMO0001, RMO0002, ... */
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoPath?: string;

  /** الاسم الكامل بالعربية */
  @Column({ type: 'varchar', length: 200 })
  fullName!: string;

  /** الاسم الكامل بالإنجليزية */
  @Column({ type: 'varchar', length: 200, nullable: true })
  fullNameEn?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nationality?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  // ---- جواز السفر ----
  @Column({ type: 'varchar', length: 50, nullable: true })
  passportNumber?: string;

  @Column({ type: 'date', nullable: true })
  passportIssueDate?: string;

  @Column({ type: 'date', nullable: true })
  passportExpiry?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  passportCountry?: string;

  // ---- الهوية الإماراتية / الإقامة ----
  @Column({ type: 'varchar', length: 50, nullable: true })
  emiratesId?: string;

  @Column({ type: 'date', nullable: true })
  emiratesIdIssueDate?: string;

  @Column({ type: 'date', nullable: true })
  emiratesIdExpiry?: string;

  /** إمارة إصدار الهوية / الإقامة */
  @Column({ type: 'varchar', length: 50, nullable: true })
  issueEmirate?: string;

  /** المهنة كما تظهر في الهوية / النظام */
  @Column({ type: 'varchar', length: 200, nullable: true })
  occupation?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** الهاتف المعروض في البيانات الأساسية عند تعدد الأرقام المرتبطة */
  @Column({ type: 'integer', nullable: true })
  primaryPhoneId?: number;

  /** active | archived */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
