import { IsInt, IsPositive } from 'class-validator';
import { BusinessCard } from '../card.interface';

export class GetCardDto {
  @IsInt()
  @IsPositive()
  id: number;
}

export type GetCardResult = BusinessCard;
