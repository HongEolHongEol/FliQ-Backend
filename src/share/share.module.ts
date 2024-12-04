import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { CardService } from 'src/card/card.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessCardEntity } from 'src/db/entities/card.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessCardEntity])],
  controllers: [ShareController],
  providers: [CardService],
})
export class ShareModule {}
