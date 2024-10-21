import { Module, forwardRef } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { BetRoomController } from './bet-room/bet-room.controller';
import { AuthController } from './auth/auth.controller';
import { BetRoomService } from './bet-room/bet-room.service';
import { BetService } from './bet/bet.service';
import { AuthService } from './auth/auth.service';
import { BetSchema } from './schemas/bet.schema';
import { BetRoomSchema } from './schemas/bet-room.schema';
import { UserSchema } from './schemas/user.schema';
import { BetController } from './bet/bet.controller';
import { BetRoomGateway } from './bet-room/bet-room.gateway';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { BetModule } from './bet/bet.module';
import { BetRoomModule } from './bet-room/bet-room.module';
import { UserModule } from './user/user.module';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { ConfigModule } from '@nestjs/config';
import { RoundSchema } from './schemas/round.schema';
import { RoundSchedulerService } from './Round/RoundSchedulerService';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.DATABASE_URL),
    MongooseModule.forFeature([
      { name: 'Bet', schema: BetSchema },
      { name: 'BetRoom', schema: BetRoomSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Round', schema: RoundSchema },
    ]),
    PassportModule,
    JwtModule.register({
      secret: 'aquickbrownfoxjumpsoverthelazydog',
      signOptions: { expiresIn: '60d' },
    }),
    AuthModule,
    forwardRef(() => BetModule), // Use forwardRef in AppModule if needed
    forwardRef(() => BetRoomModule),
    UserModule,
  ],
  controllers: [
    AppController,
    BetRoomController,
    BetController,
    AuthController,
    UserController,
  ],
  providers: [
    AppService,
    BetRoomService,
    BetService,
    AuthService,
    BetRoomGateway,
    UserService,
    RoundSchedulerService,
  ],
})
export class AppModule {}
