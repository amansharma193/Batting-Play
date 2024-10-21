import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BetRoom } from 'src/schemas/bet-room.schema';
import { BetRoomGateway } from './bet-room.gateway';
import { Bet } from 'src/schemas/bet.schema'; // Import Bet schema
import { BetService } from 'src/bet/bet.service';
import { Round } from 'src/schemas/round.schema';

@Injectable()
export class BetRoomService {
  private readonly logger = new Logger(BetRoomService.name);

  constructor(
    @InjectModel('BetRoom') private betRoomModel: Model<BetRoom>,
    @InjectModel('Round') private roundModel: Model<Round>,
    private betRoomGateway: BetRoomGateway, // For WebSocket communication
    @Inject(forwardRef(() => BetService)) private betService: BetService,
  ) {}

  async findById(id: string) {
    const room = await this.betRoomModel.findById(new Types.ObjectId(id));
    return room;
  }

  // Create a new betting room
  async createRoom(
    name: string,
    drawInterval: number,
    roomId: string,
  ): Promise<BetRoom> {
    const room = new this.betRoomModel({
      name: name,
      status: 'open',
      drawInterval,
      roomId,
    });
    await room.save();
    this.betRoomGateway.sendRoomUpdate('roomCreated', room);

    return room;
  }

  async createNewRound(roomId: string): Promise<Round> {
    const newRound = new this.roundModel({
      _id: new Types.ObjectId(),
      roundId: new Types.ObjectId(),
      winningNumber: 0, // Set this later when you determine the winner
      winner: [],
      payoutMultiplier: 0,
      status: 'open',
      startedAt: new Date(),
      endedAt: null,
      roomId,
    });

    return await newRound.save();
  }

  async closeRound(roomId: string, roundId: string): Promise<Round> {
    try {
      const existingRound = await this.roundModel.findOne({ roundId });
      if (!existingRound || existingRound.status === 'closed') {
        throw new Error('Round not found or already closed');
      }

      const { winningNumber, winners } = await this.settleBets(roomId, roundId);

      existingRound.status = 'closed';
      existingRound.endedAt = new Date();
      await existingRound.save();

      this.betRoomGateway.sendRoundClosedNotification(roomId, {
        event: 'roundClosed',
        winningNumber,
        winners,
      });

      const round = await this.createNewRound(roomId);

      return round;
    } catch (error: any) {
      throw new InternalServerErrorException('Failed to close round');
    }
  }

  async getNextRoundNumber(roomId: string): Promise<number> {
    const lastRound = await this.roundModel.find({ roomId });
    return lastRound ? lastRound.length + 1 : 1; // Start from 1 if no rounds exist
  }

  // Fetch all bets for a specific room
  async getBetsForRoom(roomId: string): Promise<Bet[]> {
    return this.betService.getBetsForRoom(roomId); // Fetch all bets for the given roomId
  }

  // Settle bets and close the room
  async settleBets(roomId: string, roundId: string): Promise<any> {
    const room = await this.betRoomModel.findById(new Types.ObjectId(roomId));

    if (!room || room.status !== 'open') {
      throw new Error('Room is not open or does not exist');
    }

    const round = await this.roundModel.findOne({ roundId });
    if (!round || round.status !== 'open') {
      throw new Error('Round is not open or does not exist');
    }

    // Fetch all bets for the room
    // const bets = await this.getBetsForRoom(roomId);
    const bets = await this.getBetsForRoom(roundId);
    const totalInvestment = bets.reduce((sum, { amount }) => sum + amount, 0);

    // Group bets by number and calculate total amount and user count for each number
    const numberStats = bets.reduce(
      (acc, bet) => {
        const { number, amount } = bet;

        if (number === 'odd' || number === 'even') {
          // Handle odd/even bets separately
          acc[number] = acc[number] || { number, amount: 0, totalUsers: 0 };
          acc[number].amount += amount;
          acc[number].totalUsers += 1;
        } else {
          // Handle specific number bets
          acc[number] = acc[number] || { number, amount: 0, totalUsers: 0 };
          acc[number].amount += amount;
          acc[number].totalUsers += 1;
        }

        return acc;
      },
      {} as Record<
        string | number,
        { number: number | 'odd' | 'even'; amount: number; totalUsers: number }
      >,
    );

    // Prepare data for winner selection
    const numbers: any[] = Object.values(numberStats);

    // Call selectWinner function to determine the winner
    const winningNumber = this.selectWinner(numbers, totalInvestment);

    // Determine if the winning number is odd or even
    const isOdd = winningNumber % 2 !== 0;

    // Fetch winners for the exact number, odd, or even bets
    const winners = await this.getWinners(roomId, winningNumber, isOdd);

    this.logger.log(
      `Winning number for room ${roomId} - ${roundId}: ${winningNumber}`,
    );
    this.logger.log(`Winners: ${winners.length}`);

    // Send real-time update to clients
    this.betRoomGateway.sendRoomUpdate(roomId, {
      event: 'betsSettled',
      winningNumber,
      winners,
    });

    // Close the room
    // room.status = 'closed';
    await room.save();

    return { winningNumber, winners };
  }

  // Automatically close the room and trigger the draw at intervals
  // async scheduleDraws(roomId: string): Promise<void> {
  //   const room = await this.betRoomModel.findById(roomId);
  //   if (!room || room.status !== 'open') {
  //     throw new Error('Room is not open or does not exist');
  //   }

  //   setTimeout(async () => {
  //     await this.settleBets(roomId);
  //   }, room['drawInterval'] * 1000); // Set timeout based on the draw interval in seconds
  // }

  // Get the current status of a room
  async getRoomStatus(roomId: string): Promise<BetRoom> {
    return await this.betRoomModel.findById(roomId).exec();
  }

  async getAllBetsByRoomId(roomId: string): Promise<any> {
    const room = await this.betRoomModel.findById(roomId).exec();
    if (room) {
      const bets = await this.getBetsForRoom(roomId);
      console.log(bets);
      return { room, bets };
    }
    return {};
  }

  // Logic to select the winner based on the given rules
  private selectWinner(
    numbers: { number: number; amount: number; totalUsers: number }[],
    totalInvestment: number,
  ): number {
    const maxPayout = totalInvestment * 0.9; // 90% of total investment

    // Ensure all numbers (0-9) are considered
    const completeNumbers = Array.from({ length: 10 }, (_, i) => ({
      number: i,
      amount: 0,
      totalUsers: 0,
    }));

    // Merge actual bet data with complete set of numbers (0-9)
    for (const bet of numbers) {
      const existingNumber = completeNumbers.find(
        (num) => num.number === bet.number,
      );
      if (existingNumber) {
        existingNumber.amount += bet.amount;
        existingNumber.totalUsers += bet.totalUsers;
      }
    }

    // Sort numbers by descending totalUsers (weight) first, then by amount
    completeNumbers.sort(
      (a, b) => b.totalUsers - a.totalUsers || b.amount - a.amount,
    );

    // Try to find a valid winner based on the maxPayout constraint
    for (const { number, amount } of completeNumbers) {
      const potentialPayout = amount * 9;

      // If the potential payout is within the max payout constraint, return this number
      if (potentialPayout <= maxPayout) {
        return number;
      }
    }

    // If no number meets the payout constraint, return any number (fallback)
    return completeNumbers[0].number;
  }

  // Fetch the winners for a specific room and winning number
  async getWinners(
    roomId: string,
    winningNumber: number,
    isOdd: boolean,
  ): Promise<any[]> {
    // Fetch all users who bet on the winning number, or bet on odd/even
    const winners = await this.betService.find({
      roomId,
      $or: [
        { number: winningNumber }, // Users who bet on the exact number
        { number: isOdd ? 'odd' : 'even' }, // Users who bet on odd or even
      ],
    });

    return winners;
  }
  async getRoomRoundsHistory(roomId: string): Promise<any> {
    const room = await this.betRoomModel
      .findById(roomId)
      .select('rounds roomName');

    if (!room) {
      throw new Error('Room not found');
    }

    const roundsHistory = room.rounds.map((round) => ({
      roundId: round.roundId,
      winningNumber: round.winningNumber,
      winner: round.winner,
    }));

    return {
      roomName: room.name,
      rounds: roundsHistory,
    };
  }
}
