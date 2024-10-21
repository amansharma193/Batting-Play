import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, HydratedDocument, Document } from 'mongoose';

@Schema()
export class Bet extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, type: SchemaTypes.Mixed }) // Allows number, 'odd', or 'even'
  number: number | 'odd' | 'even';

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, unique: true })
  roomId: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ required: true })
  roundId: string;
}

export type BetDocument = HydratedDocument<Bet>;

export const BetSchema = SchemaFactory.createForClass(Bet);
