import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, CreateUserResult } from './dto/CreateUser';
import { GetUserDto, GetUserResult } from './dto/GetUser';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<CreateUserResult> {
    return this.userService.create(createUserDto);
  }

  @Get(':id')
  async getUser(@Param() getUserDto: GetUserDto): Promise<GetUserResult> {
    return this.userService.getUser(getUserDto);
  }
}
