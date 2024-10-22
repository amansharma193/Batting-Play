// src/bet-room/bet-room.gateway.ts
import { Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BetService } from 'src/bet/bet.service';
import { BetRoomService } from './bet-room.service';

@WebSocketGateway()
export class BetRoomGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @Inject(forwardRef(() => BetService)) private betService: BetService,
    @Inject(forwardRef(() => BetRoomService))
    private betRoomService: BetRoomService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log('WebSocket server initialized', server);
  }

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, roomId: string): void {
    client.join(roomId);
    console.log(`Client ${client.id} joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, roomId: string): void {
    client.leave(roomId);
    console.log(`Client ${client.id} left room: ${roomId}`);
  }

  sendRoomUpdate(roomId: string, data: any): void {
    this.server.to(roomId).emit('roomUpdate', data);
  }

  @SubscribeMessage('placeBet')
  async handlePlaceBet(@MessageBody() betData: any): Promise<void> {
    const { userId, roomId, roundNumber, number, amount } = betData;

    // Validate wallet balance
    const hasEnoughFunds = await this.betService.checkWallet(userId, amount);
    if (!hasEnoughFunds) {
      this.sendRoomUpdate('betFailed', {
        userId,
        message: 'Insufficient funds',
      });
      return;
    }

    // Place the bet
    await this.betService.placeBet(userId, roomId, roundNumber, number, amount);

    // Notify all clients about the new bet
    this.sendRoomUpdate('betPlaced', { userId, roomId, number, amount });
  }

  @SubscribeMessage('startRound') // Listen for a 'startRound' event from the frontend
  async handleStartRound() {
    const round = await this.betRoomService.createNewRound(
      '671421cb01ef20f3a8e209dc',
    );
    this.server.emit('roundStarted', {
      message: 'A new round has started',
      roundId: round.roundId,
    });
  }

  sendRoundClosedNotification(roomId: string, message: any) {
    this.server.to(roomId).emit('roundClosed', message);
  }
  sendToUser(userId: string, update: any) {
    this.server.to(userId).emit('userUpdate', update);
  }
}
