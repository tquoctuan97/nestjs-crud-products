import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @IsMongoId()
  @IsNotEmpty()
  retailerId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  contact?: string;
}

export class UpdateSupplierDto {
  @IsMongoId()
  @IsOptional()
  retailerId?: Types.ObjectId;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;
}

export class SupplierFilterDto {
  @IsMongoId()
  @IsOptional()
  retailerId?: Types.ObjectId;

  @IsString()
  @IsOptional()
  name?: string;
}

export class PaginationDto {
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
