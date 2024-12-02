import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('business_cards')
export class BusinessCardEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  owner: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 255 })
  organization: string;

  @Column({ type: 'varchar', length: 255 })
  department: string;

  @Column({ type: 'varchar', length: 255 })
  position: string;

  @Column({ type: 'varchar', length: 255 })
  sns: string;

  @Column({ type: 'varchar', length: 255 })
  avatar: string;

  @Column('text')
  introduction: string;

  @Column({ type: 'timestamp', nullable: true })
  created_at?: Date;
}
