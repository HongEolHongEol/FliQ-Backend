import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto, CreateCardResult } from './dto/CreateCard';
import { GetCardDto, GetCardResult } from './dto/GetCard';
import { GetAllCardsDto, GetAllCardsResult } from './dto/GetAllCards';
import { FileInterceptor } from '@nestjs/platform-express';
import { AwsService } from 'src/aws/aws.service';

@Controller('card')
export class CardController {
  constructor(
    private readonly cardService: CardService,
    private readonly awsService: AwsService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createCardDto: CreateCardDto,
  ): Promise<CreateCardResult> {
    const result = await this.cardService.create(createCardDto);
    await this.awsService.upload(`c${result.id}`, file);
    return result;
  }

  @Get(':id')
  async getCard(@Param() getCardDto: GetCardDto): Promise<GetCardResult> {
    return this.cardService.getCard(getCardDto);
  }

  @Get('/all/:owner')
  async getAllCards(
    @Param() getAllCardsDto: GetAllCardsDto,
  ): Promise<GetAllCardsResult> {
    return this.cardService.getAllCards(getAllCardsDto);
  }
}
