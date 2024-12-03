import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class AwsService {
  private s3: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3 = new S3Client();
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
}
