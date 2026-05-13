import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vehicle } from './Vehicle';

@Entity('vehicle_custom_fields')
export class VehicleCustomField {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  vehicleId!: number;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'boolean', default: false })
  enableAlert!: boolean;

  @Column({ type: 'date', nullable: true })
  alertDate?: Date;

  @Column({ type: 'integer', nullable: true })
  daysBeforeExpiry?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
