import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class AwsService {
  private s3: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get('S3_REGION'),
    });
    this.bucket = this.configService.get('S3_BUCKET_NAME');
  }

  async upload(
    fileName: string,
    file: Express.Multer.File,
    extension: string = 'png',
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
      Body: file.buffer,
      ACL: 'public-read',
      ContentType: `image/${extension}`,
    });

    await this.s3.send(command);
  }

  async delete(fileName: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
    });

    await this.s3.send(command);
  }
}
