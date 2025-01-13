import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import {
  AUDIT_LOG_ACTION_ENUM,
  AUDIT_LOG_MODULE_ENUM,
} from '../audit-logs/audit-logs.constant';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateRetailerDto,
  RetailerFilterDto,
  UpdateRetailerDto,
} from './dto/retailer.dto';
import { Retailer, RetailerDocument } from './entities/retailer.entity';

@Injectable()
export class RetailerService {
  constructor(
    @InjectModel(Retailer.name)
    private retailerModel: Model<RetailerDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(createRetailerDto: CreateRetailerDto, req): Promise<Retailer> {
    const retailer = new this.retailerModel({
      ...createRetailerDto,
      ownerId: createRetailerDto.ownerId
        ? new mongoose.Types.ObjectId(createRetailerDto.ownerId)
        : new mongoose.Types.ObjectId(req.user.id),
    });
    const modifiedBy = (req as any).user?.id;
    try {
      // Save retailer
      const savedRetailer = await retailer.save();

      // Create audit log
      await this.auditLogsService.createLog({
        retailerId: new mongoose.Types.ObjectId(savedRetailer._id),
        modifiedBy: new mongoose.Types.ObjectId(modifiedBy),
        module: AUDIT_LOG_MODULE_ENUM.RETAILER,
        action: AUDIT_LOG_ACTION_ENUM.CREATE,
        oldData: null,
        newData: savedRetailer,
      });

      return savedRetailer;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Retailer name must be unique.');
      }

      throw new InternalServerErrorException('Failed to create retailer.');
    }
  }

  /**
   * Get paginated retailers with optional filters.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @param filters - Additional filters (e.g., ownerId, isDeleted).
   * @returns Paginated result with total count and retailers.
   */
  async findAll(
    page = 1,
    limit = 10,
    filters: RetailerFilterDto = {},
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    data: Retailer[];
  }> {
    const query: any = {};

    // Add filters if provided
    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }
    if (filters.address) {
      query.address = { $regex: filters.address, $options: 'i' };
    }
    if (filters.ownerId) {
      query.ownerId = filters.ownerId;
    }
    if (filters.isDeleted !== undefined) {
      query.isDeleted = filters.isDeleted;
    }

    // Calculate total count and fetch retailers
    const total = await this.retailerModel.countDocuments(query);
    const data = await this.retailerModel
      .find(query)
      .sort({ createdAt: -1 }) // Sort by createdAt (latest first)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'ownerId',
        select: '_id name email avatar',
      })
      .exec();

    return {
      total,
      page,
      limit,
      data,
    };
  }

  async findOne(id: string): Promise<Retailer> {
    const retailer = await this.retailerModel
      .findById(id)
      .populate({ path: 'ownerId', select: '_id name email avatar' })
      .exec();
    if (!retailer || retailer.isDeleted) {
      throw new NotFoundException(`Retailer with ID ${id} not found`);
    }

    return retailer;
  }

  async update(
    id: string,
    updateRetailerDto: UpdateRetailerDto,
    req,
  ): Promise<Retailer> {
    const existingRetailer = await this.retailerModel.findById(id);
    if (!existingRetailer) {
      throw new NotFoundException('Retailer not found');
    }
    const updatedRetailer = await this.retailerModel
      .findByIdAndUpdate(id, updateRetailerDto, { new: true })
      .exec();
    if (!updatedRetailer || updatedRetailer.isDeleted) {
      throw new NotFoundException(`Retailer with ID ${id} not found`);
    }
    const modifiedBy = (req as any).user?.id;

    await this.auditLogsService.createLog({
      retailerId: new mongoose.Types.ObjectId(updatedRetailer._id),
      modifiedBy: new mongoose.Types.ObjectId(modifiedBy),
      module: AUDIT_LOG_MODULE_ENUM.RETAILER,
      action: AUDIT_LOG_ACTION_ENUM.CREATE,
      oldData: existingRetailer,
      newData: updatedRetailer,
    });

    return updatedRetailer;
  }

  async remove(id: string, req): Promise<Retailer> {
    const updatedRetailer = await this.retailerModel
      .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
      .exec();
    if (!updatedRetailer) {
      throw new NotFoundException(`Retailer with ID ${id} not found`);
    }

    // Get the user's ID from the JWT payload
    const modifiedBy = (req as any).user?.id;

    await this.auditLogsService.createLog({
      retailerId: new mongoose.Types.ObjectId(id),
      modifiedBy: new mongoose.Types.ObjectId(modifiedBy),
      module: AUDIT_LOG_MODULE_ENUM.RETAILER,
      action: AUDIT_LOG_ACTION_ENUM.DELETE,
      oldData: updatedRetailer,
      newData: null,
    });
    return updatedRetailer;
  }
}
