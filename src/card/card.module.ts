import { Module } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessCardEntity } from 'src/db/entities/card.entity';
import { AwsModule } from 'src/aws/aws.module';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessCardEntity]), AwsModule],
  controllers: [CardController],
  providers: [CardService],
})
export class CardModule {}
