import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import {
  ChangePasswordDto,
  RefreshTokenDto,
  SignInDto,
} from './dto/sign-in.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('auth')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() signInDto: SignInDto, @Req() req: Request, @Ip() ip) {
    let clientIp = ip;

    // CF-Connecting-IP is a Cloudflare specific header
    if (req.headers['cf-connecting-ip']) {
      clientIp = req.headers['cf-connecting-ip'].toString();
    } else if (req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].toString().split(',')[0].trim();
    }

    const userAgent = req.headers['user-agent'] || '';

    return this.authService.signIn(
      signInDto.email,
      signInDto.password,
      userAgent,
      clientIp,
    );
  }

  @Post('change-password')
  @ApiBearerAuth()
  changePassword(@Req() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.email, changePasswordDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  getProfile(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  refreshAccessToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req,
    @Ip() ip,
  ) {
    let clientIp = ip;

    // CF-Connecting-IP is a Cloudflare specific header
    if (req.headers['cf-connecting-ip']) {
      clientIp = req.headers['cf-connecting-ip'].toString();
    } else if (req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].toString().split(',')[0].trim();
    }

    const userAgent = req.headers['user-agent'] || '';

    return this.authService.refreshAccessToken(
      refreshTokenDto.refreshToken,
      userAgent,
      clientIp,
    );
  }

  @Post('logout')
  @ApiBearerAuth()
  logout(@Req() req, @Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(req.user.id, refreshTokenDto.refreshToken);
  }
}
