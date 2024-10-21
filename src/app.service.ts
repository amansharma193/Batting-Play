import { Injectable } from '@nestjs/common';
// import { RoundSchedulerService } from './Round/RoundSchedulerService';
// import { BetService } from './bet/bet.service';
// import { BetRoomService } from './bet-room/bet-room.service';

@Injectable()
export class AppService {
  constructor() {}
  getHello(): string {
    return 'Hello World!';
  }

  // onModuleInit() {
  //   // Create a new round every minute
  //   setInterval(async () => {
  //     const newRound = await this.betRoomService.createNewRound(
  //       '671421cb01ef20f3a8e209dc',
  //     );

  //     // Close the round after 60 seconds if it has bets
  //     setTimeout(async () => {
  //       const bets = await this.betService.findBetsByRound(
  //         newRound._id.toString(),
  //       );
  //       if (bets.length > 0) {
  //         await this.betRoomService.settleBets(
  //           '671421cb01ef20f3a8e209dc',
  //           newRound._id.toString(),
  //         );
  //       }
  //       await this.betRoomService.closeRound(
  //         '671421cb01ef20f3a8e209dc',
  //         newRound._id.toString(),
  //       );
  //     }, 60000); // 60000 milliseconds = 1 minute
  //   }, 60000); // 60000 milliseconds = 1 minute
  // }
}
