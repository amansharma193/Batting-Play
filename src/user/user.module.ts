import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserSchema } from 'src/schemas/user.schema';
import { BetSchema } from 'src/schemas/bet.schema';
import { RoundSchema } from 'src/schemas/round.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema }, // Register User schema
      { name: 'Bet', schema: BetSchema }, // Register Bet schema
      { name: 'Round', schema: RoundSchema }, // Register Round schema
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, MongooseModule], // ✅ Export MongooseModule so that AuthModule can use UserModel
})
export class UserModule {}
