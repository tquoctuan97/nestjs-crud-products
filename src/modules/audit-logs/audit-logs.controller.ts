import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';

@ApiBearerAuth()
@ApiTags('audit-logs')
@Controller('api/v1/admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async getAuditLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('retailerId') retailerId?: string,
    @Query('modifiedBy') modifiedBy?: string,
    @Query('action') action?: string,
    @Query('module') module?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    return this.auditLogsService.getAuditLogs(pageNumber, pageSize, {
      retailerId,
      modifiedBy,
      action,
      module,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
