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
import { Request } from 'express';
import {
  CreateSupplierDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { SupplierDocument } from './entities/supplier.entity';
import { SupplierService } from './supplier.service';

@ApiBearerAuth()
@Controller('api/v1/admin/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @Req() req,
  ): Promise<SupplierDocument> {
    const supplier = await this.supplierService.create(createSupplierDto, req);

    return supplier;
  }

  @Get()
  findAll(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query() filters: SupplierFilterDto,
  ) {
    return this.supplierService.findAll(page, limit, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SupplierDocument> {
    return this.supplierService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Req() req,
  ): Promise<SupplierDocument> {
    const updatedSupplier = await this.supplierService.update(
      id,
      updateSupplierDto,
      req,
    );

    return updatedSupplier;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req): Promise<SupplierDocument> {
    const deletedSupplier = await this.supplierService.remove(id, req);

    return deletedSupplier;
  }
}
