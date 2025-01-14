import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierDocument = Supplier & Document;

@Schema({ timestamps: true, versionKey: false })
export class Supplier extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Retailer' })
  retailerId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String })
  contact: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
