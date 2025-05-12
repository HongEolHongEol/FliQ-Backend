import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsPhoneNumber,
  IsPositive,
  IsString,
} from 'class-validator';
import { BusinessCard } from '../card.interface';

export class CreateCardDto {
  @IsString()
  name: string;

  @IsString()
  @IsPhoneNumber('KR')
  contact: string;

  @IsEmail()
  email: string;

  @IsString()
  organization: string;

  @IsString()
  position: string;

  @IsString()
  introduction: string;

  @IsInt()
  @IsPositive()
  user_id: number;

  @IsBoolean()
  private: boolean;
}

export type CreateCardResult = Pick<BusinessCard, 'id'>;
