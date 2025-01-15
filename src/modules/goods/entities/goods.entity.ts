import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GoodDocument = Good & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Good extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Retailer' })
  retailerId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  category: string;

  @Prop()
  unit: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const GoodSchema = SchemaFactory.createForClass(Good);
