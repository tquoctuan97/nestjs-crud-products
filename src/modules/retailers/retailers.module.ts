import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Retailer, RetailerSchema } from './entities/retailer.entity';
import { RetailerService } from './retailers.service';
import { RetailerController } from './retailers.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Retailer.name, schema: RetailerSchema },
    ]),
    AuditLogsModule,
    UsersModule,
  ],
  exports: [RetailerService],
  controllers: [RetailerController],
  providers: [RetailerService],
})
export class RetailersModule {}
