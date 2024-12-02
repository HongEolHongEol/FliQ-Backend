import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto, CreateCardResult } from './dto/CreateCard';
import { GetCardDto, GetCardResult } from './dto/GetCard';
import { GetAllCardsDto, GetAllCardsResult } from './dto/GetAllCards';

@Controller('card')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post()
  async create(
    @Body() createCardDto: CreateCardDto,
  ): Promise<CreateCardResult> {
    return this.cardService.create(createCardDto);
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
