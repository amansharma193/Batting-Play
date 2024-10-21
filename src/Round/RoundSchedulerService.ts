import { BetRoomService } from 'src/bet-room/bet-room.service';
import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule'; // Import Cron
// import { BetRoomService } from './round.service';

@Injectable()
export class RoundSchedulerService {
  constructor(@Inject(BetRoomService) private betRoomService: BetRoomService) {}

  @Cron('*/1 * * * *') // This cron job will run every minute
  async startNewRound() {
    // Trigger starting a new round every minute
    await this.betRoomService.createNewRound('671421cb01ef20f3a8e209dc');
  }
}
