import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { Repository } from 'typeorm';
import { User } from './user.interface';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getUser(id: number): Promise<User> {
    const userEntity = await this.userRepository.findOne({ where: { id } });
    if (!userEntity) {
      this.logger.error(`User id(${id}) does not exist!`);
      return null;
    }
    return {
      id,
      email: userEntity.email,
      created_at: userEntity.created_at!.toNumber(),
    };
  }
}
