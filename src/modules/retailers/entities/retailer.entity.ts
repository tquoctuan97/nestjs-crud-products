import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RetailerDocument = Retailer & Document;

@Schema({ timestamps: true, versionKey: false })
export class Retailer extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  name: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const RetailerSchema = SchemaFactory.createForClass(Retailer);
