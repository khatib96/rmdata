import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../types/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  username!: string;

  // Email is optional in the app; avoid UNIQUE failures when multiple users have empty email.
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'integer' })
  roleId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.EMPLOYEE,
  })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', nullable: true })
  branchId?: number;

  @Column({ type: 'integer', nullable: true })
  entityId?: number;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  userType!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  linkedEntityType?: string;

  @Column({ type: 'integer', nullable: true })
  linkedEntityId?: number;

  @Column({ type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ type: 'varchar', nullable: true })
  passwordChangedAt?: string;

  @Column({ type: 'varchar', nullable: true })
  lastLoginAt?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
