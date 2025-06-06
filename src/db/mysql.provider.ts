import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class MysqlConfigProvider implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE'),
      timezone: 'Z',
      charset: 'UTF8MB4_GENERAL_CI',
      autoLoadEntities: true,
      synchronize: this.configService.get<boolean>('DB_USESYNC', false),
      logging: this.configService.get<boolean>('DB_LOGGING', true),
      retryAttempts: 2,
    };
  }
}
