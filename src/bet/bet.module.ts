// src/bet/bet.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BetSchema } from 'src/schemas/bet.schema';
import { BetController } from './bet.controller';
import { BetService } from './bet.service';
import { BetRoomModule } from 'src/bet-room/bet-room.module';
import { UserSchema } from 'src/schemas/user.schema';
import { RoundSchema } from 'src/schemas/round.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Bet', schema: BetSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Round', schema: RoundSchema },
    ]), // Register Bet schema
    forwardRef(() => BetRoomModule),
  ],
  providers: [BetService],
  controllers: [BetController],
  exports: [BetService, MongooseModule], // Only export BetService and MongooseModule
})
export class BetModule {}
