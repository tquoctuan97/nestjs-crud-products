import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsObject,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateAuditLogDto {
  @IsMongoId()
  @IsNotEmpty()
  retailerId: Types.ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  modifiedBy: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  collection: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsObject()
  @IsOptional()
  oldData?: object;

  @IsObject()
  @IsOptional()
  newData?: object;
}

export class AuditLogFilterDto {
  @IsMongoId()
  @IsOptional()
  retailerId?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  modifiedBy?: Types.ObjectId;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  collection?: string;
}

export class PaginationDto {
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
