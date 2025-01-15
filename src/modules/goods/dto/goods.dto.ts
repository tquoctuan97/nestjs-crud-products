import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';

export class CreateGoodDto {
  @IsMongoId()
  @IsNotEmpty()
  retailerId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  unit?: string;
}

export class UpdateGoodDto {
  @IsMongoId()
  @IsOptional()
  retailerId?: Types.ObjectId;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;
}

export class GoodFilterDto {
  @IsMongoId()
  @IsOptional()
  retailerId?: Types.ObjectId;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class PaginationDto {
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
