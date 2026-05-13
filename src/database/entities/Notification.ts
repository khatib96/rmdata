import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
}

export enum NotificationEntityType {
  BRANCH = 'branch',
  EMPLOYEE = 'employee',
  VEHICLE = 'vehicle',
  HOUSING = 'housing',
  ENTITY = 'entity',
  LICENSE = 'license',
  LEASE = 'lease',
}

@Entity('notifications')
@Index(['entityType', 'entityId'])
@Index(['dueDate'])
@Index(['isRead'])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  entityType!: NotificationEntityType;

  @Column({ type: 'integer' })
  entityId!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'date', nullable: true })
  dueDate?: Date;

  @Column({
    type: 'varchar',
    length: 20,
    enum: NotificationSeverity,
    default: NotificationSeverity.WARNING,
  })
  severity!: NotificationSeverity;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  /** وقت تحديد التنبيه كمقروء — يُستخدم لحذف التنبيهات المقروءة تلقائياً بعد 24 ساعة */
  @Column({ type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ type: 'boolean', default: false })
  isArchived!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  relatedField?: string; // e.g., 'passportExpiry', 'licenseExpiry', 'insuranceExpiry'

  @CreateDateColumn()
  createdAt!: Date;
}
