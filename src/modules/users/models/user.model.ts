import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationParams } from 'src/common/pagination/pagination.model';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface ActiveSession {
  refreshToken: string;
  userAgent: string;
  clientIp: string;
  lastActiveDate: Date;
}

export class UserParams extends PaginationParams {
  @ApiPropertyOptional({
    description: '`active` | `inactive`',
  })
  status?: UserStatus;
}
