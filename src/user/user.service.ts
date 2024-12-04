import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../db/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto, CreateUserResult } from './dto/CreateUser';
import { GetUserDto, GetUserResult } from './dto/GetUser';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async create({ email, password }: CreateUserDto): Promise<CreateUserResult> {
    const userEntity = this.userRepository.create({
      email,
      password,
    });

    await this.userRepository.save(userEntity);

    const { id } = userEntity;
    return { id };
  }

  async getUser({ id }: GetUserDto): Promise<GetUserResult> {
    const userEntity = await this.userRepository.findOne({
      where: { id },
    });

    if (userEntity == null) {
      this.logger.error(`User id(${id}) does not exist!`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...withoutPassword } = userEntity;
    return withoutPassword as GetUserResult;
  }
}
