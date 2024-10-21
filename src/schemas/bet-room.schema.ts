import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Round, RoundSchema } from './round.schema';

@Schema()
export class BetRoom {
  @Prop({
    required: true,
    default: new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  drawInterval: number;

  @Prop({ type: [RoundSchema], default: [] }) // Add an array of rounds
  rounds: Round[];
}

export const BetRoomSchema = SchemaFactory.createForClass(BetRoom);
export type BetRoomDocument = HydratedDocument<BetRoom>;
