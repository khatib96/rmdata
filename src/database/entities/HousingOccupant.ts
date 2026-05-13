import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { HousingUnit } from './HousingUnit';
import { Employee } from './Employee';

@Entity('housing_occupants')
export class HousingOccupant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  housingUnitId!: number;

  @ManyToOne(() => HousingUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'housingUnitId' })
  housingUnit!: HousingUnit;

  @Column({ type: 'integer', nullable: true })
  employeeId?: number;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employeeId' })
  employee?: Employee;

  @Column({ type: 'integer', nullable: true })
  employerId?: number;

  /** اسم الساكن (عند عدم الربط بموظف أو صاحب عمل) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  name?: string;

  /** دور: ساكن رئيسي، ساكن، إلخ */
  @Column({ type: 'varchar', length: 100, nullable: true })
  role?: string;

  @Column({ type: 'date', nullable: true })
  fromDate?: Date;

  @Column({ type: 'date', nullable: true })
  toDate?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
