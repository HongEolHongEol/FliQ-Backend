import {
  IsEmail,
  IsInt,
  IsPhoneNumber,
  IsPositive,
  IsString,
} from 'class-validator';
import { BusinessCard } from '../card.interface';

export class CreateCardDto {
  @IsInt()
  @IsPositive()
  owner: number;

  @IsString()
  name: string;

  @IsString()
  title: string;

  @IsString()
  @IsPhoneNumber('KR')
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  address: string;

  @IsString()
  organization: string;

  @IsString()
  department: string;

  @IsString()
  position: string;

  @IsString()
  sns: string;

  @IsString()
  avatar: string;

  @IsString()
  introduction: string;
}

export type CreateCardResult = Pick<BusinessCard, 'id'>;
