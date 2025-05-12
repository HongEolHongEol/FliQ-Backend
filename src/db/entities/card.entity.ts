import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('business_cards')
export class BusinessCardEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  contact: string;

  @Column({ type: 'varchar', length: 100 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  organization: string;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({ type: 'varchar', length: 500 })
  introduction: string;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'tinyint', width: 1 })
  private: boolean;
}
