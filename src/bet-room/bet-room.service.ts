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
  private roomTimers: {
    [roomId: string]: {
      roundId: string;
      startTime: number;
      timer?: NodeJS.Timeout;
    };
  } = {};
  private activeUsersInRoom: { [roomId: string]: Set<string> } = {}; // Track active users per room

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
  async createRoom(name: string, drawInterval: number): Promise<BetRoom> {
    const room = new this.betRoomModel({
      name: name,
      status: 'open',
      drawInterval,
    });
    const savedRoom = await room.save();
    this.betRoomGateway.sendRoomUpdate('roomCreated', room);
    this.startRound(savedRoom._id.toString(), drawInterval);
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

    const response = await newRound.save();

    // this.betRoomGateway.sendRoomUpdate(roomId, { roundId: response.roundId });
    return response;
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    // Initialize the room's user list if not already done
    if (!this.activeUsersInRoom[roomId]) {
      this.activeUsersInRoom[roomId] = new Set<string>();
    }

    // Add user to the active users list
    this.activeUsersInRoom[roomId].add(userId);
    const remainingTime = this.getRemainingTime(roomId);
    const roundId = this.roomTimers[roomId]?.roundId || null;

    // If no active round and there are users, start a new round
    if (!this.roomTimers[roomId] && this.activeUsersInRoom[roomId].size > 0) {
      this.startRound(roomId, 60); // Start a new round with a 60-second interval
    }

    // Notify the user about the current round
    this.betRoomGateway.sendToUser(userId, {
      event: 'joinRoom',
      roundId,
      remainingTime,
    });
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    if (this.activeUsersInRoom[roomId]) {
      this.activeUsersInRoom[roomId].delete(userId);

      // If no users remain in the room, stop the timer and pause rounds
      if (this.activeUsersInRoom[roomId].size === 0) {
        this.stopRound(roomId);
      }
    }
  }
  getRemainingTime(roomId: string): number {
    const roomTimer = this.roomTimers[roomId];
    if (roomTimer) {
      const elapsedTime = (Date.now() - roomTimer.startTime) / 1000;
      return Math.max(0, 60 - elapsedTime); // Assuming 60 seconds per round
    }
    return 0;
  }
  async startRound(roomId: string, drawInterval: number): Promise<void> {
    const roundId = this.generateRoundId();
    const startTime = new Date();

    // Create a new round document and save it asynchronously in the database
    const newRound = new this.roundModel({
      roundId,
      roomId,
      startTime,
    });

    await newRound.save(); // Save the round details to the database

    // Only start the round if there are active users in the room
    if (
      this.activeUsersInRoom[roomId] &&
      this.activeUsersInRoom[roomId].size > 0
    ) {
      const timer = setTimeout(async () => {
        await this.settleBets(roomId, roundId); // Pass roundId to settleBets
      }, drawInterval * 1000);

      // Store the round timer information
      this.roomTimers[roomId] = {
        roundId,
        startTime: startTime.getTime(),
        timer,
      };

      // Notify users about the new round asynchronously
      await this.betRoomGateway.sendRoomUpdate(roomId, {
        event: 'newRound',
        roundId,
        remainingTime: drawInterval,
      });
    }
  }
  stopRound(roomId: string): void {
    const roomTimer = this.roomTimers[roomId];
    if (roomTimer && roomTimer.timer) {
      clearTimeout(roomTimer.timer); // Clear the round timer
      delete this.roomTimers[roomId]; // Remove the round timer data
      this.logger.log(
        `Round stopped for room: ${roomId} due to no active users.`,
      );
    }
  }

  generateRoundId(): string {
    return new Types.ObjectId().toString(); // You can replace this with UUID generation logic
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
    const winningNumber = await this.selectWinner(numbers, totalInvestment);

    // Determine if the winning number is odd or even
    const isOdd = winningNumber % 2 !== 0;

    // Fetch winners for the exact number, odd, or even bets
    const winners = await this.getWinners(
      roomId,
      winningNumber,
      isOdd,
      roundId,
    );

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

    if (
      this.activeUsersInRoom[roomId] &&
      this.activeUsersInRoom[roomId].size > 0
    ) {
      await this.startRound(roomId, 60); // Start a new round with a 60-second interval
    }

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
      return { room, bets };
    }
    return {};
  }

  // Logic to select the winner based on the given rules
  private async selectWinner(
    numbers: {
      number: number | 'odd' | 'even';
      amount: number;
      totalUsers: number;
    }[],
    totalInvestment: number,
  ): Promise<number> {
    try {
      const maxPayout = totalInvestment * 0.9; // 90% of total investment

      // Initialize complete number set (0-9) and map bets to numbers
      const completeNumbers = Array.from({ length: 10 }, (_, i) => ({
        number: i,
        amount: 0,
        totalUsers: 0,
      }));

      // Separate tracking for "odd" and "even" bets
      const oddBet = { amount: 0, totalUsers: 0 };
      const evenBet = { amount: 0, totalUsers: 0 };

      // Merge bet data into complete numbers and handle "odd"/"even" bets
      numbers.forEach(({ number, amount, totalUsers }) => {
        if (number === 'odd') {
          oddBet.amount += amount;
          oddBet.totalUsers += totalUsers;
        } else if (number === 'even') {
          evenBet.amount += amount;
          evenBet.totalUsers += totalUsers;
        } else {
          completeNumbers[number].amount += amount;
          completeNumbers[number].totalUsers += totalUsers;
        }
      });

      // Filter out profit numbers within maxPayout limit
      const profitNumbers = completeNumbers.filter(
        ({ amount }) => amount * 9 <= maxPayout,
      );

      if (profitNumbers.length === 0) {
        return 0; // No valid number found, return default
      }

      // Include odd/even numbers in the profit calculation
      let bestNumber = profitNumbers[0];
      let highestPayout = bestNumber.amount * 9;
      let fewestUsers = bestNumber.totalUsers;

      for (const current of profitNumbers) {
        const potentialPayout = current.amount * 9;

        if (
          potentialPayout > highestPayout ||
          (potentialPayout === highestPayout &&
            current.totalUsers < fewestUsers)
        ) {
          bestNumber = current;
          highestPayout = potentialPayout;
          fewestUsers = current.totalUsers;
        } else if (
          potentialPayout === highestPayout &&
          current.totalUsers === fewestUsers &&
          Math.random() < 0.5
        ) {
          bestNumber = current;
        }
      }

      // After checking individual numbers, compare with odd/even bets
      const oddPayout = oddBet.amount * 9;
      const evenPayout = evenBet.amount * 9;

      if (
        oddPayout <= maxPayout &&
        (oddPayout > highestPayout ||
          (oddPayout === highestPayout && oddBet.totalUsers < fewestUsers))
      ) {
        // Odd wins
        const oddNumbers = [1, 3, 5, 7, 9];
        return oddNumbers[Math.floor(Math.random() * oddNumbers.length)];
      }

      if (
        evenPayout <= maxPayout &&
        (evenPayout > highestPayout ||
          (evenPayout === highestPayout && evenBet.totalUsers < fewestUsers))
      ) {
        // Even wins
        const evenNumbers = [0, 2, 4, 6, 8];
        return evenNumbers[Math.floor(Math.random() * evenNumbers.length)];
      }

      // Return the best individual number if odd/even didn’t win
      return bestNumber.number;
    } catch (e) {
      console.log('Error selecting winner:', e);
      return 0; // Fallback in case of error
    }
  }

  // Fetch the winners for a specific room and winning number
  async getWinners(
    roomId: string,
    winningNumber: number,
    isOdd: boolean,
    roundId: string,
  ): Promise<any[]> {
    // Fetch all users who bet on the winning number, or bet on odd/even
    const winners = await this.betService.find({
      roomId,
      roundId,
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
