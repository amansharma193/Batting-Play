import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module'; // Import UserModule

@Module({
  imports: [
    JwtModule.register({
      secret: 'aquickbrownfoxjumpsoverthelazydog',
      signOptions: { expiresIn: '1d' },
    }),
    UserModule, // ✅ Import UserModule to have access to UserModel
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
