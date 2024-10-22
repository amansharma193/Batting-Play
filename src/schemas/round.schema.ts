import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  ObjectId,
  SchemaTypes,
  Types,
} from 'mongoose';
@Schema()
export class Round extends Document {
  @Prop({
    type: SchemaTypes.ObjectId,
    default: new Types.ObjectId(),
  })
  _id: ObjectId;

  @Prop({ required: true, default: new Types.ObjectId(), unique: false })
  roundId: string;

  @Prop({ required: false })
  winningNumber: number;

  @Prop({ required: true, default: [] })
  winner: string[];

  @Prop({ required: true, default: 0 })
  payoutMultiplier: number;

  @Prop({ default: 'open' }) // Each round has its own status
  status: 'open' | 'closed';

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop({ default: null, required: false })
  endedAt: Date;
  @Prop({ default: null, required: true })
  roomId: string;
}

export type UserDocument = HydratedDocument<Round>;

export const RoundSchema = SchemaFactory.createForClass(Round);
