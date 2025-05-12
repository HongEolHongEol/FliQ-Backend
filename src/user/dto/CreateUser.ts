import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { User } from '../user.interface';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  profile_img_url: string;
}

export type CreateUserResult = Pick<User, 'id'>;
