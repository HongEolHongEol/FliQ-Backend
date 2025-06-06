import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessCardEntity } from 'src/db/entities/card.entity';
import { Repository } from 'typeorm';
import { CreateCardDto, CreateCardResult } from './dto/CreateCard';
import { GetCardDto, GetCardResult } from './dto/GetCard';
import { GetAllCardsDto, GetAllCardsResult } from './dto/GetAllCards';
import { DeleteCardDto, DeleteCardResult } from './dto/DeleteCard';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    @InjectRepository(BusinessCardEntity)
    private cardRepository: Repository<BusinessCardEntity>,
  ) {}

  async create(createCardDto: CreateCardDto): Promise<CreateCardResult> {
    const cardEntity = this.cardRepository.create({
      ...createCardDto,
    });

    await this.cardRepository.save(cardEntity);

    const { id } = cardEntity;
    return { id };
  }

  async getCard({ id }: GetCardDto): Promise<GetCardResult> {
    const cardEntity = await this.cardRepository.findOne({
      where: { id },
    });

    if (cardEntity == null) {
      this.logger.error(`Card id(${id}) does not exist!`);
      return null;
    }

    return cardEntity as GetCardResult;
  }

  async getAllCards({ user_id }: GetAllCardsDto): Promise<GetAllCardsResult> {
    const cards = await this.cardRepository.find({
      where: { user_id },
    });

    if (cards == null) {
      this.logger.error(`Card List by owner(${user_id}) do not exist!`);
      return null;
    }

    return cards as GetAllCardsResult;
  }

  async delete({ id }: DeleteCardDto): Promise<DeleteCardResult> {
    await this.cardRepository.delete(id);
    return { message: 'success' };
  }
}
