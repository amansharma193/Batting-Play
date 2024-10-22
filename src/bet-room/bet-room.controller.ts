// src/bet-room/bet-room.controller.ts
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BetRoomService } from './bet-room.service';
import { BetService } from '../bet/bet.service';

interface CreateRoomDto {
  name: string;
  drawInterval: number;
  roomId: string;
}
@Controller('bet-room')
export class BetRoomController {
  constructor(
    private readonly betRoomService: BetRoomService,
    private readonly betService: BetService, // Handle bet-related routes
  ) {}

  // Create a new room
  @Post('create')
  async createRoom(@Body() body: CreateRoomDto) {
    const { name, drawInterval } = body; // Destructuring with defaults
    return this.betRoomService.createRoom(
      name || `defaultName-${new Date().getTime()}`,
      drawInterval || 10,
    ); // Set defaults if missing
  }

  // Place a bet in a specific room
  @Post(':roomId/place-bet')
  async placeBet(
    @Param('roomId') roomId: string,
    @Body('userId') userId: string,
    @Body('number') number: number,
    @Body('amount') amount: number,
    @Body('roundId') roundId?: string,
  ) {
    return this.betService.placeBet(userId, roomId, number, amount, roundId);
  }

  // Get status of a specific room
  @Get(':roomId/status')
  async getRoomStatus(@Param('roomId') roomId: string) {
    return this.betRoomService.getRoomStatus(roomId);
  }

  // Manually trigger the draw and settle bets in a room
  // @Post(':roomId/settle')
  // async settleBets(@Param('roomId') roomId: string) {
  //   return this.betRoomService.settleBets(roomId);
  // }

  @Get(':roomId/bets')
  async getAllBets(@Param('roomId') roomId: string) {
    return await this.betRoomService.getAllBetsByRoomId(roomId);
  }

  @Get(':roomId/user/:userId/winnings')
  async getUserWinnings(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
  ): Promise<any> {
    const winnings = await this.betService.getUserWinnings(roomId, userId);
    return { winnings };
  }

  @Get(':roomId/history')
  async getRoomRoundsHistory(@Param('roomId') roomId: string): Promise<any> {
    const roomHistory = await this.betRoomService.getRoomRoundsHistory(roomId);
    return roomHistory;
  }
}
