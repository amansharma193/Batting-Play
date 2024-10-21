// src/bet/bet.service.ts
import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bet } from 'src/schemas/bet.schema';
import { BetRoomService } from 'src/bet-room/bet-room.service';
import { User } from 'src/schemas/user.schema';
import { Round } from 'src/schemas/round.schema';

@Injectable()
export class BetService {
  constructor(
    @InjectModel('Bet') private betModel: Model<Bet>,
    @InjectModel('User') private userModel: Model<User>, // Inject the User model
    @InjectModel('Round') private readonly roundModel: Model<Round>,
    @Inject(forwardRef(() => BetRoomService))
    private betRoomService: BetRoomService, // Inject BetRoomService with forwardRef
  ) {}

  // Place a new bet
  async placeBet(
    userId: string,
    roomId: string,
    number: number | 'odd' | 'even',
    amount: number,
    roundId?: string,
  ): Promise<Bet> {
    const room = await this.betRoomService.findById(roomId);
    if (!room || room.status !== 'open') {
      throw new Error('Room is not open or does not exist');
    }
    const userExists = await this.checkUserExists(userId);
    if (!userExists) {
      throw new NotFoundException('User does not exist'); // Throw an exception if user is not found
    }

    let round: Round = await this.roundModel.findOne({
      roundId: new Types.ObjectId(roundId),
    });

    if (!round || round.status !== 'open') {
      round = (await this.betRoomService.createNewRound(roomId)) as Round;
    }

    const betsForRound = await this.find({
      roomId,
      _id: round._id,
    });

    if (betsForRound.length === 0) {
      this.startBetTimer(roomId, round.roundId);
    }

    const existingBet = await this.betModel.findOne({ userId, roomId, number });

    if (existingBet) {
      return existingBet; // Return the existing bet if found
    }
    // await Bet.create(newBet); // Only insert if it does not exist
    const newBet = new this.betModel({
      userId,
      roomId,
      roundId: round.roundId,
      number,
      amount,
    });
    return await newBet.save();
  }

  private startBetTimer(roomId: string, roundId: string): void {
    setTimeout(async () => {
      console.log('closing rounf');
      await this.betRoomService.closeRound(roomId, roundId);
    }, 10000); // 60 seconds
  }

  async checkUserExists(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    return !!user; // Return true if the user exists, otherwise false
  }
  // Get bets for a room
  async getBetsForRoom(roomId: string): Promise<Bet[]> {
    return await this.betModel.find({ roomId }).exec();
  }

  // Get winners for a room based on the winning number
  async getWinners(roomId: string, winningNumber: number): Promise<Bet[]> {
    return await this.betModel.find({ roomId, number: winningNumber }).exec();
  }

  // Get all bets for a specific user
  async getBetsByUser(userId: string): Promise<Bet[]> {
    return await this.betModel.find({ userId }).exec();
  }
  async find(query: any) {
    return await this.betModel.find(query);
  }

  async checkWallet(userId: string, amount: number): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.walletBalance >= amount; // Check if wallet balance is sufficient
  }

  async getUserWinnings(roomId: string, userId: string): Promise<number> {
    // Fetch all the bets the user placed in this room
    const userBets = await this.betModel.find({ userId });

    let totalWinnings = 0;

    for (const bet of userBets) {
      // Fetch the rounds from the Round collection based on the roundNumber
      const round = await this.roundModel.findOne({
        roundId: bet.roundId,
        status: 'closed',
      });

      if (round) {
        // Calculate winnings based on whether the user bet matches the winning condition
        if (
          (bet.number === 'odd' && round.winningNumber % 2 !== 0) ||
          (bet.number === 'even' && round.winningNumber % 2 === 0) ||
          bet.number === round.winningNumber
        ) {
          totalWinnings += bet.amount * round.payoutMultiplier;
        }
      }
    }

    return totalWinnings;
  }

  async findBetsByRound(roundId: string): Promise<Bet[]> {
    return await this.betModel.find({ roundId }).exec();
  }
}
