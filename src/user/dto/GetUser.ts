import { IsInt, IsPositive } from 'class-validator';
import { User } from '../user.interface';

export class GetUserDto {
  @IsInt()
  @IsPositive()
  id: number;
}

export type GetUserResult = Omit<User, 'password'>;
