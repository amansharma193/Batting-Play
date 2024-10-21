// src/bet/bet.controller.ts
import { Controller, Post } from '@nestjs/common';
import { BetService } from './bet.service';
// import { BetRoomService } from 'src/bet-room/bet-room.service';

@Controller('bet')
export class BetController {
  constructor(private betService: BetService) {}

  @Post('place')
  async placeBet(
    userId: string,
    roomId: string,
    number: number | 'odd' | 'even',
    amount: number,
    roundId?: string,
  ): Promise<any> {
    // Let BetService handle the room checking logic
    return await this.betService.placeBet(
      userId,
      roomId,
      number,
      amount,
      roundId,
    );
  }
}
