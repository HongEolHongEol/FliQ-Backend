import { Controller, Get, Param, Render } from '@nestjs/common';
import { CardService } from 'src/card/card.service';

@Controller('share')
export class ShareController {
  constructor(private cardService: CardService) {}

  @Get('/card/:id')
  @Render('card_share.ejs')
  async cardShareView(@Param('id') id: string) {
    const redirect = {
      statusCode: 404,
      url: '/share/unknown',
    };
    if (!id) return redirect;

    const cardEntity = await this.cardService.getCard({ id: Number(id) });
    if (cardEntity == null) return redirect;

    return { name: cardEntity.name };
  }

  @Get('unknown')
  @Render('unknown.ejs')
  async unknownShareView() {
    return {};
  }
}
