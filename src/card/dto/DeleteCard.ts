import { IsInt, IsPositive } from 'class-validator';

export class DeleteCardDto {
  @IsInt()
  @IsPositive()
  id: number;
}

export type DeleteCardResult = {
  message: string;
};
