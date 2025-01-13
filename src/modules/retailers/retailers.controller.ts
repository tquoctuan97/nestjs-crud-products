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
import {
  CreateRetailerDto,
  RetailerFilterDto,
  UpdateRetailerDto,
} from './dto/retailer.dto';
import { RetailerService } from './retailers.service';

@ApiBearerAuth()
@Controller('api/v1/admin/retailers')
export class RetailerController {
  constructor(private readonly retailerService: RetailerService) {}

  @Post()
  create(@Body() createRetailerDto: CreateRetailerDto, @Req() req: Request) {
    return this.retailerService.create(createRetailerDto, req);
  }

  @Get()
  findAll(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query() filters: RetailerFilterDto,
  ) {
    return this.retailerService.findAll(page, limit, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.retailerService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRetailerDto: UpdateRetailerDto,
    @Req() req: Request,
  ) {
    const updatedRetailer = await this.retailerService.update(
      id,
      updateRetailerDto,
      req,
    );

    return updatedRetailer;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.retailerService.remove(id, req);
  }
}
