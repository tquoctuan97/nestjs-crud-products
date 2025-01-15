import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { GoodService } from './goods.service';

import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateGoodDto, GoodFilterDto, UpdateGoodDto } from './dto/goods.dto';
import { GoodDocument } from './entities/goods.entity';

interface AuthenticatedRequest extends Request {
  user?: {
    _id?: string;
    retailerId: string;
  };
}

@ApiBearerAuth()
@Controller('api/v1/admin/goods')
export class GoodController {
  constructor(private readonly goodService: GoodService) {}

  @Post()
  async create(
    @Body() createGoodDto: CreateGoodDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<GoodDocument> {
    return await this.goodService.create(createGoodDto, req);
  }

  @Get()
  findAll(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query() filters: GoodFilterDto,
  ) {
    return this.goodService.findAll(page, limit, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<GoodDocument> {
    return this.goodService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGoodDto: UpdateGoodDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<GoodDocument> {
    return await this.goodService.update(id, updateGoodDto, req);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<GoodDocument> {
    return await this.goodService.remove(id, req);
  }
}
