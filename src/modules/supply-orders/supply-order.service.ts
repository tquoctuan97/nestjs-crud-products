import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AUDIT_LOG_ACTION_ENUM,
  AUDIT_LOG_MODULE_ENUM,
} from '../audit-logs/audit-logs.constant';

import {
  SupplyOrder,
  SupplyOrderDocument,
} from './entities/supply-order.entity';
import {
  CreateSupplyOrderDto,
  SupplyOrderFilterDto,
  UpdateSupplyOrderDto,
} from './dto/supply-order.dto';

@Injectable()
export class SupplyOrderService {
  constructor(
    @InjectModel(SupplyOrder.name)
    private supplyOrderModel: Model<SupplyOrderDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createSupplyOrderDto: CreateSupplyOrderDto,
    req,
  ): Promise<SupplyOrderDocument> {
    const supplyOrder = new this.supplyOrderModel({
      ...createSupplyOrderDto,
      createdBy: new Types.ObjectId(req.user.id),
      retailerId: new Types.ObjectId(createSupplyOrderDto.retailerId),
      supplierId: new Types.ObjectId(createSupplyOrderDto.supplierId),
    });
    try {
      const savedSupplyOrder = await supplyOrder.save();
      // Create audit log
      await this.auditLogsService.createLog({
        retailerId: new Types.ObjectId(savedSupplyOrder.retailerId),
        modifiedBy: new Types.ObjectId(req.user?.id),
        module: AUDIT_LOG_MODULE_ENUM.SUPPLY_ORDER,
        action: AUDIT_LOG_ACTION_ENUM.CREATE,
        oldData: null,
        newData: savedSupplyOrder,
      });
      return savedSupplyOrder;
    } catch (e) {
      throw new BadRequestException('Failed to create Supply Order');
    }
  }

  /**
   * Get paginated supplyOrders with optional filters.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @param filters - Additional filters (e.g., ownerId, isDeleted).
   * @returns Paginated result with total count and supplyOrders.
   */
  async findAll(
    page = 1,
    limit = 10,
    filters: SupplyOrderFilterDto = {},
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    data: SupplyOrder[];
  }> {
    const query: any = {};

    // Add filters if provided
    if (filters.retailerId) {
      query.retailerId = filters.retailerId;
    }
    if (filters.supplierId) {
      query.supplierId = filters.supplierId;
    }

    const skip = (page - 1) * limit;
    const [supplyOrders, total] = await Promise.all([
      this.supplyOrderModel
        .find(query)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limit)
        .select('-createdAt -updatedAt -__v -items -isDeleted')
        .populate({ path: 'retailerId', select: '_id name' })
        .populate({ path: 'supplierId', select: '_id name' })
        .populate({ path: 'createdBy', select: '_id name' })
        // .populate({
        //   path: 'items.goodId',
        //   select: '_id name unit description category',
        // })
        .exec(),
      this.supplyOrderModel.countDocuments(query).exec(),
    ]);

    return {
      total,
      page,
      limit,
      data: supplyOrders,
    };
  }

  async findOne(id: string): Promise<SupplyOrderDocument> {
    const supplyOrder = await this.supplyOrderModel
      .findById(id)
      .populate({ path: 'retailerId', select: '_id name' })
      .populate({ path: 'supplierId', select: '_id name' })
      .populate({
        path: 'items.goodId',
        select: '_id name unit description category',
      })
      .populate({ path: 'createdBy', select: '_id name' })
      .exec();
    if (!supplyOrder) {
      throw new NotFoundException(`SupplyOrder with ID ${id} not found`);
    }

    return supplyOrder;
  }

  async update(
    id: string,
    updateSupplyOrderDto: UpdateSupplyOrderDto,
    req,
  ): Promise<SupplyOrderDocument> {
    const existingSupplyOrder = await this.supplyOrderModel.findById(id).exec();
    if (!existingSupplyOrder) {
      throw new NotFoundException('SupplyOrder not found');
    }
    const updateSupplyOrder = await this.supplyOrderModel
      .findByIdAndUpdate(id, updateSupplyOrderDto, { new: true })
      .exec();

    await this.auditLogsService.createLog({
      retailerId: new Types.ObjectId(updateSupplyOrder.retailerId),
      modifiedBy: new Types.ObjectId(req.user?.id),
      module: AUDIT_LOG_MODULE_ENUM.SUPPLY_ORDER,
      action: AUDIT_LOG_ACTION_ENUM.UPDATE,
      oldData: existingSupplyOrder,
      newData: updateSupplyOrder,
    });

    return updateSupplyOrder;
  }

  async remove(id: string, req): Promise<SupplyOrderDocument> {
    const updatedSupplyOrder = await this.supplyOrderModel
      .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
      .exec();
    if (!updatedSupplyOrder) {
      throw new NotFoundException('SupplyOrder not found');
    }

    await this.auditLogsService.createLog({
      retailerId: new Types.ObjectId(updatedSupplyOrder.retailerId),
      modifiedBy: new Types.ObjectId(req.user?.id),
      module: AUDIT_LOG_MODULE_ENUM.SUPPLY_ORDER,
      action: AUDIT_LOG_ACTION_ENUM.DELETE,
      oldData: updatedSupplyOrder,
      newData: null,
    });
    return updatedSupplyOrder;
  }
}
