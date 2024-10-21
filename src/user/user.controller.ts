import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Create a new user
  @Post()
  async createUser(@Body() createUserDto: any) {
    return await this.userService.createUser(createUserDto);
  }

  // Get a user by ID
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
    return await this.userService.findUserById(userId);
  }

  // Update user information
  @Put(':id')
  async updateUser(@Param('id') userId: string, @Body() updateUserDto: any) {
    return await this.userService.updateUser(userId, updateUserDto);
  }

  // Delete a user
  @Delete(':id')
  async deleteUser(@Param('id') userId: string) {
    return await this.userService.deleteUser(userId);
  }

  @Get(':userId/total-winnings')
  async getTotalUserWinnings(@Param('userId') userId: string): Promise<any> {
    const totalWinnings = await this.userService.getTotalUserWinnings(userId);
    return { totalWinnings };
  }
}
