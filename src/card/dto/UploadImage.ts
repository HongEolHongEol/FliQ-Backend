import { IsNumberString } from 'class-validator';

export class UploadImageDto {
  @IsNumberString()
  id: string;
}

export type UploadImageResult = {
  message: string;
};
