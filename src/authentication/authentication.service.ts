import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UserDto } from './dto/userDto.dto';
import { RequestOtpDto } from './dto/requestOtpDto.dto';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { ReturnedUserDto } from '../user/dto/returnedUser.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthenticationService {
  constructor(
    private userService: UserService,
    @Inject('JWT_ACCESS_TOKEN') private readonly jwtAccessService: JwtService,
    @Inject('JWT_REFRESH_TOKEN') private readonly jwtRefreshService: JwtService,
  ) { }

  // Login
  async signIn(
    email: string,
    password: string,
  ): Promise<ReturnedUserDto> {
    const users = await this.userService.getUser(email);

    if (!users || users.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user.user_id, email: user.email };

    const accessToken = await this.jwtAccessService.signAsync(payload);
    const refreshToken = await this.jwtRefreshService.signAsync(payload);



    const result = {
      userId: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };

    return result;
  }

  // Refresh tokens (rotation)
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; user: UserDto }> {
    try {
      // Verify current refresh token
      const payload = this.jwtRefreshService.verify(refreshToken);
      const users = await this.userService.getUser(payload.email);
      if (!users || users.length === 0) {
        throw new UnauthorizedException('User not found');
      }
      const user = users[0];


      const newAccessToken = this.jwtAccessService.sign({
        userId: payload.userId,
        email: payload.email
      });
      const newRefreshToken = this.jwtRefreshService.sign({
        userId: payload.userId,
        email: payload.email
      });
      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: {
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.phonenumber,
          role: user.role
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }


  async logout(refreshToken: string): Promise<{ message: string }> {

    try {
      this.jwtRefreshService.verify(refreshToken);

      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async requestOtp(
    phone: RequestOtpDto
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }


  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const { email, otp } = dto;

   
    const storedOtp = '123456';

    if (otp !== storedOtp) {
      return {
        success: false,
        message: 'Invalid OTP',
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }

  // async changePassword(userId: string, oldPassword: string, newPassword: string) {
  //   const users = await this.userService.getUserById(userId);
  //   if (!users || users.length === 0) throw new UnauthorizedException('User not found');

  //   const user = users[0];

  //   const isOldValid = await bcrypt.compare(oldPassword, user.password);
  //   if (!isOldValid) throw new UnauthorizedException('Old password is incorrect');

  //   const hashed = await bcrypt.hash(newPassword, 10);
  //   await this.userService.updatePassword(userId, hashed);

  //   return { message: 'Password changed successfully' };
  // }

}
