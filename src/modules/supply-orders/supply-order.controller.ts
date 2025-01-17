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
import { ApiBearerAuth } from '@nestjs/swagger';

import { SupplyOrderService } from './supply-order.service';
import {
  CreateSupplyOrderDto,
  SupplyOrderFilterDto,
  UpdateSupplyOrderDto,
} from './dto/supply-order.dto';
import { SupplyOrderDocument } from './entities/supply-order.entity';

@ApiBearerAuth()
@Controller('api/v1/admin/supply-orders')
export class SupplyOrderController {
  constructor(private readonly supplyOrderService: SupplyOrderService) {}

  @Post()
  create(
    @Body() createSupplyOrderDto: CreateSupplyOrderDto,
    @Req() req: Request,
  ): Promise<SupplyOrderDocument> {
    return this.supplyOrderService.create(createSupplyOrderDto, req);
  }

  @Get()
  findAll(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query() filters: SupplyOrderFilterDto,
  ) {
    return this.supplyOrderService.findAll(page, limit, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SupplyOrderDocument> {
    return this.supplyOrderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSupplyOrderDto: UpdateSupplyOrderDto,
    @Req() req: Request,
  ): Promise<SupplyOrderDocument> {
    return this.supplyOrderService.update(id, updateSupplyOrderDto, req);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SupplyOrderDocument> {
    return this.supplyOrderService.remove(id, req);
  }
}
