import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BetRoomController } from './bet-room.controller';
import { BetRoomService } from './bet-room.service';
import { BetRoomSchema } from 'src/schemas/bet-room.schema';
import { BetRoomGateway } from './bet-room.gateway';
import { BetModule } from 'src/bet/bet.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'BetRoom', schema: BetRoomSchema }]),
    forwardRef(() => BetModule), // Import BetModule to access BetService
  ],
  controllers: [BetRoomController],
  providers: [BetRoomService, BetRoomGateway],
  exports: [BetRoomService, BetRoomGateway, MongooseModule], // No need to export BetRoomModule itself
})
export class BetRoomModule {}
