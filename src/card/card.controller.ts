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
import { AwsService } from 'src/aws/aws.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadImageDto, UploadImageResult } from './dto/UploadImage';

@Controller('card')
export class CardController {
  constructor(
    private readonly cardService: CardService,
    private readonly awsService: AwsService,
  ) {}

  @Post()
  async create(
    @Body() createCardDto: CreateCardDto,
  ): Promise<CreateCardResult> {
    const result = await this.cardService.create(createCardDto);
    return result;
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() image: Express.Multer.File,
    @Body() uploadImageDto: UploadImageDto,
  ): Promise<UploadImageResult> {
    await this.awsService.upload(`card/${uploadImageDto.id}.png`, image);
    return { message: 'success' };
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
