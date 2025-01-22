import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  /**
   * Get paginated audit logs with optional filters.
   * @param page - Current page number.
   * @param limit - Number of items per page.
   * @param filters - Additional filters (e.g., retailerId, modifiedBy).
   * @returns Paginated result with total count and logs.
   */
  async getAuditLogs(
    page = 1,
    limit = 10,
    filters: {
      retailerId?: string;
      modifiedBy?: string;
      action?: string;
      module?: string;
    } = {},
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    logs: AuditLog[];
  }> {
    const query: any = {};

    // Add filters if provided
    if (filters.retailerId) {
      query.retailerId = filters.retailerId;
    }
    if (filters.modifiedBy) {
      query.modifiedBy = filters.modifiedBy;
    }
    if (filters.action) {
      query.action = { $regex: filters.action, $options: 'i' }; // Case-insensitive search
    }
    if (filters.module) {
      query.collectionName = { $regex: filters.module, $options: 'i' }; // Case-insensitive search
    }

    // Calculate total count and fetch logs
    const total = await this.auditLogModel.countDocuments(query);
    const logs = await this.auditLogModel
      .find(query)
      .sort({ modifiedDate: -1 }) // Sort by modifiedDate (latest first)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'retailerId', select: '_id name' })
      .populate({ path: 'modifiedBy', select: '_id name email avatar' })
      .exec();

    return {
      total,
      page,
      limit,
      logs,
    };
  }
  async createLog(data: Partial<AuditLog>) {
    return this.auditLogModel.create(data);
  }

  async findOne(id: string): Promise<AuditLog> {
    console.log(id);
    const auditLog = await this.auditLogModel
      .findById(id)
      .populate({ path: 'retailerId', select: '_id name' })
      .populate({ path: 'modifiedBy', select: '_id name email avatar' })
      .exec();
    if (!auditLog) {
      throw new NotFoundException(`AuditLog with ID ${id} not found`);
    }
    return auditLog;
  }
}
