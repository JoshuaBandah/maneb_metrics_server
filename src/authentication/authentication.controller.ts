import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { loginUserDto } from './dto/loginUserDto.dto';
import { UserDto } from './dto/userDto.dto';
import { RequestOtpDto } from './dto/requestOtpDto.dto';
import { VerifyOtpDto } from './dto/verifyOtp.dto';
import { Public } from '../common/decorators/public.decorator';
import { ReturnedUserDto } from '../user/dto/returnedUser.dto';

@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) { }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/login')
  async login(
    @Body() loginUserDto: loginUserDto,
  ): Promise<ReturnedUserDto> {
    const { email, password } = loginUserDto;
    return this.authenticationService.signIn(email, password);
  }

  @Public()
  @Post('/refresh')
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string; user: UserDto }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authenticationService.refreshAccessToken(refreshToken);
  }


  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token required');
    return this.authenticationService.logout(refreshToken);
  }

  @Public()
  @Post('/otp_request')
  async requestOtp(
    @Body() requestOtpDto: RequestOtpDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {

    const res = this.authenticationService.requestOtp(requestOtpDto)
    return res
  }

  @Public()
  @Post('/otp_verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.authenticationService.verifyOtp(dto);
  }

}
