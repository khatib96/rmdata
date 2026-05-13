import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { HousingUnit } from './HousingUnit';

@Entity('housing_installments')
export class HousingInstallment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  housingId!: number;

  @ManyToOne(() => HousingUnit, (housing) => housing.installments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'housingId' })
  housing!: HousingUnit;

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
