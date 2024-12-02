import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.interface';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('user')
  async getUser(@Param('id') id: number): Promise<User> {
    return await this.userService.getUser(id);
  }
}
