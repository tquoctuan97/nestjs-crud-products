import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/sign-in.dto';
import { comparePassword } from './utils/hashPassword';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/entities/user.entity';
import { Model } from 'mongoose';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async signIn(
    email: string,
    password: string,
    userAgent: string,
    clientIp: string,
  ) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isMatchPassword = await comparePassword(password, user.password);
    if (!isMatchPassword)
      throw new UnauthorizedException('Invalid email or password');

    const payload = { id: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.accessTokenExpiryTime, // Short-lived access token
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.refreshTokenExpiryTime, // Long-lived refresh token
    });

    user.activeSessionList.push({
      refreshToken,
      userAgent,
      clientIp,
      lastActiveDate: new Date(),
    });

    // Save refresh token in the database (hashed for security)
    await user.save();

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refreshAccessToken(
    refreshToken: string,
    userAgent: string,
    clientIp: string,
  ) {
    try {
      // Validate the refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken);

      // Check if refresh token matches the one in the database
      const user = await this.userModel.findById(payload.id).exec();

      if (
        !user ||
        !user.activeSessionList.find((s) => s.refreshToken === refreshToken)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Generate a new access token
      const newAccessToken = await this.jwtService.signAsync(newPayload, {
        expiresIn: jwtConstants.accessTokenExpiryTime,
      });

      // Generate a new refresh token
      const newRefreshToken = await this.jwtService.signAsync(newPayload, {
        expiresIn: jwtConstants.refreshTokenExpiryTime,
      });

      // Update the refresh token in the database and
      // TODO: remove session has last active date is expired
      const newActiveSessionList = user.activeSessionList.map((s) => {
        if (s.refreshToken === refreshToken) {
          s.refreshToken = newRefreshToken;
          s.userAgent = userAgent;
          s.clientIp = clientIp;
          s.lastActiveDate = new Date();
        }
        return s;
      });

      await this.userModel.findByIdAndUpdate(user.id, {
        activeSessionList: newActiveSessionList,
      });

      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (err) {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }
  }

  async logout(userId: string, refreshToken: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('User not found');

    // Clear refresh token from the database
    const newActiveSessionList = user.activeSessionList?.filter(
      (s) => s.refreshToken !== refreshToken,
    );

    await this.userModel.findByIdAndUpdate(user.id, {
      activeSessionList: newActiveSessionList,
    });
    return { message: 'Logout successful' };
  }

  async changePassword(email: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.usersService.findByEmail(email);

    const isMatchPassword = await comparePassword(
      changePasswordDto.oldPassword,
      user.password,
    );

    if (!isMatchPassword) {
      throw new BadRequestException('Old password is incorrect');
    }

    const isMatchConfirmPassword =
      changePasswordDto.confirmPassword === changePasswordDto.newPassword;

    if (!isMatchConfirmPassword) {
      throw new BadRequestException('Confirm password is incorrect');
    }

    return await this.usersService.update(user.id, {
      password: changePasswordDto.confirmPassword,
      activeSessionList: [],
    });
  }

  async getProfile(id: string) {
    return await this.usersService.findById(id);
  }
}
