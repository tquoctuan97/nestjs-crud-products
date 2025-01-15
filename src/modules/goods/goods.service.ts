import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AUDIT_LOG_MODULE_ENUM,
  AUDIT_LOG_ACTION_ENUM,
} from '../audit-logs/audit-logs.constant';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateGoodDto, GoodFilterDto, UpdateGoodDto } from './dto/goods.dto';
import { Good, GoodDocument } from './entities/goods.entity';

@Injectable()
export class GoodService {
  constructor(
    @InjectModel(Good.name)
    private goodModel: Model<GoodDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(createGoodDto: CreateGoodDto, req): Promise<GoodDocument> {
    const good = new this.goodModel({
      ...createGoodDto,
      retailerId: new Types.ObjectId(createGoodDto.retailerId),
    });
    const modifiedBy = (req as any).user?.id;
    try {
      const savedGood = await good.save();
      // Create audit log
      await this.auditLogsService.createLog({
        retailerId: new Types.ObjectId(savedGood.retailerId),
        modifiedBy: new Types.ObjectId(modifiedBy),
        module: AUDIT_LOG_MODULE_ENUM.GOODS,
        action: AUDIT_LOG_ACTION_ENUM.CREATE,
        oldData: null,
        newData: savedGood,
      });
      return savedGood;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create good.');
    }
  }

  /**
   * Get paginated goods with optional filters.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @param filters - Additional filters (e.g., ownerId, isDeleted).
   * @returns Paginated result with total count and goods.
   */
  async findAll(
    page = 1,
    limit = 10,
    filters: GoodFilterDto = {},
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    data: Good[];
  }> {
    const query: any = { isDeleted: false };

    // Add filters if provided
    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }
    if (filters.category) {
      query.category = { $regex: filters.category, $options: 'i' };
    }
    if (filters.retailerId) {
      query.retailerId = filters.retailerId;
    }
    const skip = (page - 1) * limit;
    const [goods, total] = await Promise.all([
      this.goodModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'retailerId', select: '_id name' })
        .exec(),
      this.goodModel.countDocuments(query).exec(),
    ]);
    return {
      total,
      page,
      limit,
      data: goods,
    };
  }

  async findOne(id: string): Promise<GoodDocument> {
    const good = await this.goodModel
      .findById(id)
      .populate({ path: 'retailerId', select: '_id name' })
      .exec();
    if (!good || good.isDeleted) {
      throw new NotFoundException(`Good with ID ${id} not found`);
    }
    return good;
  }

  async update(
    id: string,
    updateGoodDto: UpdateGoodDto,
    req,
  ): Promise<GoodDocument> {
    const existingGood = await this.goodModel.findById(id).exec();
    if (!existingGood) {
      throw new NotFoundException(`Good with ID ${id} not found`);
    }
    const updatedGood = await this.goodModel
      .findByIdAndUpdate(id, updateGoodDto, { new: true })
      .exec();
    if (!updatedGood || updatedGood.isDeleted) {
      throw new NotFoundException(`Good with ID ${id} not found`);
    }
    const modifiedBy = (req as any).user?.id;

    await this.auditLogsService.createLog({
      retailerId: new Types.ObjectId(updatedGood.retailerId),
      modifiedBy: new Types.ObjectId(modifiedBy),
      module: AUDIT_LOG_MODULE_ENUM.GOODS,
      action: AUDIT_LOG_ACTION_ENUM.UPDATE,
      oldData: existingGood,
      newData: updatedGood,
    });
    return updatedGood;
  }

  async remove(id: string, req): Promise<GoodDocument> {
    const updatedGood = await this.goodModel
      .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
      .exec();
    if (!updatedGood || updatedGood.isDeleted) {
      throw new NotFoundException(`Good with ID ${id} not found`);
    }

    const modifiedBy = (req as any).user?.id;
    await this.auditLogsService.createLog({
      retailerId: new Types.ObjectId(updatedGood.retailerId),
      modifiedBy: new Types.ObjectId(modifiedBy),
      module: AUDIT_LOG_MODULE_ENUM.GOODS,
      action: AUDIT_LOG_ACTION_ENUM.DELETE,
      oldData: updatedGood,
      newData: null,
    });
    return updatedGood;
  }
}
