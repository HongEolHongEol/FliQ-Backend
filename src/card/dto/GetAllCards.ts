import { IsInt, IsPositive } from 'class-validator';
import { BusinessCard } from '../card.interface';

export class GetAllCardsDto {
  @IsInt()
  @IsPositive()
  user_id: number;
}

export type GetAllCardsResult = BusinessCard[];
