import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { User } from '../user.interface';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export type CreateUserResult = Omit<User, 'password' | 'created_at'>;
