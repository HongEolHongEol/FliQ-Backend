import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlConfigProvider } from './db/mysql.provider';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CardModule } from './card/card.module';
import { AwsModule } from './aws/aws.module';
import { ShareModule } from './share/share.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.development.env', '.production.env'],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useClass: MysqlConfigProvider,
    }),
    UserModule,
    AuthModule,
    CardModule,
    AwsModule,
    ShareModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
