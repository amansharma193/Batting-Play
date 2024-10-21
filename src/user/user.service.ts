import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bet } from 'src/schemas/bet.schema';
import { Round } from 'src/schemas/round.schema';
import { User, UserDocument } from 'src/schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel('Bet') private betModel: Model<Bet>,
    @InjectModel('Round') private roundModel: Model<Round>,
  ) {}

  // Create a new user
  async createUser(createUserDto: any): Promise<User> {
    const newUser = new this.userModel(createUserDto);
    return await newUser.save();
  }

  // Find a user by ID
  async findUserById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId).exec();
  }

  // Find a user by email (for login or validation purposes)
  async findUserByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Update user information
  async updateUser(userId: string, updateData: any): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .exec();
  }

  // Delete a user
  async deleteUser(userId: string): Promise<any> {
    return this.userModel.findByIdAndDelete(userId).exec();
  }

  async getTotalUserWinnings(userId: string): Promise<number> {
    // Fetch all the bets the user has placed
    const userBets = await this.betModel.find({ userId });

    let totalWinnings = 0;

    for (const bet of userBets) {
      // Fetch the round associated with each bet
      const round = await this.roundModel.findOne({
        roundId: bet.roundId,
        status: 'closed', // Ensure the round is closed before calculating winnings
      });

      if (round) {
        // Calculate winnings based on whether the user's bet matches the winning condition
        if (
          (bet.number === 'odd' && round.winningNumber % 2 !== 0) ||
          (bet.number === 'even' && round.winningNumber % 2 === 0) ||
          bet.number === round.winningNumber
        ) {
          // Multiply the bet amount with the payoutMultiplier
          totalWinnings += bet.amount * round.payoutMultiplier;
        }
      }
    }

    return totalWinnings;
  }
}
